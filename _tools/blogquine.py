#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import binascii
import lzma
import os
import struct
import sys
import time

# ============================================================
# Part 1: 最小 LZMA1 range coder（只做编码）
#
# 设计目标：只实现 quine 构造需要的 token：literal / match / rep0-match /
# end-marker，编码字节与历史内容无关（不维护输出历史），
# 这是"先算结构、后填数据"两阶段装配的基础。
# 参考：Igor Pavlov 的 LZMA SDK (LzmaEnc.c / LzmaDec.c)。
# ============================================================

kNumBitModelTotalBits = 11
kBitModelTotal = 1 << kNumBitModelTotalBits          # 2048
kNumMoveBits = 5
kTopValue = 1 << 24                                   # 0x1000000

kNumStates = 12
kNumLitStates = 7
kNumPosBitsMax = 4
kNumLenToPosStates = 4
kNumAlignBits = 4
kEndPosModelIndex = 14
kNumFullDistances = 1 << (kEndPosModelIndex >> 1)     # 128
kMatchMinLen = 2
kNumLowLenBits = 3
kNumMidLenBits = 3
kNumHighLenBits = 8
kNumLowLenSymbols = 1 << kNumLowLenBits               # 8
kNumMidLenSymbols = 1 << kNumMidLenBits               # 8
kNumPosSlotBits = 6

PROB_INIT = kBitModelTotal >> 1                       # 1024


class RangeEncoder:
    """LZMA 的区间编码器。low 是 64 位（要容纳进位），range 是 32 位。"""

    def __init__(self):
        self.low = 0
        self.range = 0xFFFFFFFF
        self.cache = 0
        self.cache_size = 1          # 初值 1 -> 第一个输出字节恒为 0x00
        self.buf = bytearray()

    def _shift_low(self):
        if (self.low & 0xFFFFFFFF) < 0xFF000000 or (self.low >> 32) != 0:
            temp = self.cache
            while True:
                self.buf.append((temp + (self.low >> 32)) & 0xFF)
                temp = 0xFF
                self.cache_size -= 1
                if self.cache_size == 0:
                    break
            self.cache = (self.low >> 24) & 0xFF
        self.cache_size += 1
        # 注意：C 里 `(UInt32)low << 8` 会截断回 32 位，必须照做，
        # 否则 low 的高位会一直累积，进位位 (low>>32) 就不止 0/1 了。
        self.low = ((self.low & 0xFFFFFFFF) << 8) & 0xFFFFFFFF

    def encode_bit(self, probs, idx, bit):
        p = probs[idx]
        bound = (self.range >> kNumBitModelTotalBits) * p
        if bit == 0:
            self.range = bound
            probs[idx] = p + ((kBitModelTotal - p) >> kNumMoveBits)
        else:
            self.low += bound
            self.range -= bound
            probs[idx] = p - (p >> kNumMoveBits)
        while self.range < kTopValue:
            self.range = (self.range << 8) & 0xFFFFFFFF
            self._shift_low()

    def encode_direct_bits(self, value, num_bits):
        for i in range(num_bits - 1, -1, -1):
            self.range >>= 1
            if (value >> i) & 1:
                self.low += self.range
            while self.range < kTopValue:
                self.range = (self.range << 8) & 0xFFFFFFFF
                self._shift_low()

    def bittree_encode(self, probs, off, num_bits, symbol):
        """普通位树：MSB 优先，节点下标从 1 开始。"""
        m = 1
        for i in range(num_bits - 1, -1, -1):
            bit = (symbol >> i) & 1
            self.encode_bit(probs, off + m, bit)
            m = (m << 1) | bit

    def bittree_reverse_encode(self, probs, off, num_bits, symbol):
        """反向位树：LSB 优先，用于 SpecPos / Align。"""
        m = 1
        for i in range(num_bits):
            bit = symbol & 1
            symbol >>= 1
            self.encode_bit(probs, off + m, bit)
            m = (m << 1) | bit

    def finish(self):
        for _ in range(5):
            self._shift_low()
        return bytes(self.buf)


def _pos_slot_and_bits(d):
    """把 0 基距离 d (=真实距离-1) 拆成 (posSlot, 低位数, 低位值)。"""
    if d < 4:
        return d, 0, 0
    # posSlot >= 4 时：numDirectBits=(slot>>1)-1, base=(2|(slot&1))<<numDirectBits
    for slot in range(4, 64):
        n = (slot >> 1) - 1
        base = (2 | (slot & 1)) << n
        if d < base + (1 << n):
            return slot, n, d - base
    raise ValueError("distance too large: %d" % d)


class LzmaEncoder:
    def __init__(self, lc=3, lp=0, pb=2):
        """
        不维护输出假历史：match 的编码字节只取决于 (dist,len,pos)，与历史内容无关，
        因此 quine 构造（先算结构、后填数据）不需要逐字节复制假历史。
        """
        self.lc, self.lp, self.pb = lc, lp, pb
        self.pos_mask = (1 << pb) - 1
        self.lp_mask = (1 << lp) - 1
        self.rc = RangeEncoder()
        self.pos = 0            # 已输出字节数
        self.state = 0
        self.prev_byte = 0
        self.reps = [0, 0, 0, 0]      # rep0..rep3，存的是 0 基距离
        self.out = bytearray()
        # 概率模型
        n = PROB_INIT
        self.p_is_match = [n] * (kNumStates << kNumPosBitsMax)
        self.p_is_rep = [n] * kNumStates
        self.p_is_rep_g0 = [n] * kNumStates
        self.p_is_rep_g1 = [n] * kNumStates
        self.p_is_rep_g2 = [n] * kNumStates
        self.p_rep0_long = [n] * (kNumStates << kNumPosBitsMax)
        self.p_pos_slot = [n] * (kNumLenToPosStates << kNumPosSlotBits)
        self.p_spec_pos = [n] * (kNumFullDistances - kEndPosModelIndex)   # 114
        self.p_align = [n] * (1 << kNumAlignBits)
        self.p_len_choice = [n] * 2
        self.p_len_low = [n] * (16 * kNumLowLenSymbols)
        self.p_len_mid = [n] * (16 * kNumMidLenSymbols)
        self.p_len_high = [n] * (1 << kNumHighLenBits)
        self.p_rep_len_choice = [n] * 2
        self.p_rep_len_low = [n] * (16 * kNumLowLenSymbols)
        self.p_rep_len_mid = [n] * (16 * kNumMidLenSymbols)
        self.p_rep_len_high = [n] * (1 << kNumHighLenBits)
        self.p_lit = [n] * (0x300 << (lc + lp))

    # ---------- 内部 ----------
    @property
    def pos_state(self):
        return self.pos & self.pos_mask

    def _encode_len(self, choice, low, mid, high, length):
        """choice 是 2 元素数组：choice[0]=choice 位，choice[1]=choice2 位。"""
        ps = self.pos_state
        l = length - kMatchMinLen
        if l < kNumLowLenSymbols:
            self.rc.encode_bit(choice, 0, 0)
            self.rc.bittree_encode(low, ps << kNumLowLenBits, kNumLowLenBits, l)
        else:
            self.rc.encode_bit(choice, 0, 1)
            l -= kNumLowLenSymbols
            if l < kNumMidLenSymbols:
                self.rc.encode_bit(choice, 1, 0)
                self.rc.bittree_encode(mid, ps << kNumMidLenBits, kNumMidLenBits, l)
            else:
                self.rc.encode_bit(choice, 1, 1)
                self.rc.bittree_encode(high, 0, kNumHighLenBits, l - kNumMidLenSymbols)

    # ---------- 对外 token ----------
    def literal(self, b):
        if self.state >= kNumLitStates:
            raise NotImplementedError("matched-literal 未实现（quine 构造不需要）")
        # 每个符号先编 isMatch 位：0 表示这是 literal
        ps = self.pos_state
        self.rc.encode_bit(self.p_is_match, (self.state << kNumPosBitsMax) + ps, 0)
        lit_state = ((self.pos & self.lp_mask) << self.lc) + (self.prev_byte >> (8 - self.lc))
        self.rc.bittree_encode(self.p_lit, lit_state * 0x300, 8, b)
        self.out.append(b)
        self.prev_byte = b
        self.pos += 1
        # UpdateState_Literal
        if self.state <= 3:
            self.state = 0
        elif self.state <= 9:
            self.state -= 3
        else:
            self.state -= 6

    def _write_dist(self, dist, lts):
        d = dist - 1
        slot, n, low_bits = _pos_slot_and_bits(d)
        self.rc.bittree_encode(self.p_pos_slot, lts << kNumPosSlotBits,
                               kNumPosSlotBits, slot)
        if slot >= 4:
            if slot < kEndPosModelIndex:
                base = (2 | (slot & 1)) << n
                off = base - slot - 1
                self.rc.bittree_reverse_encode(self.p_spec_pos, off, n, low_bits)
            else:
                self.rc.encode_direct_bits(low_bits >> kNumAlignBits, n - kNumAlignBits)
                self.rc.bittree_reverse_encode(self.p_align, 0, kNumAlignBits,
                                               low_bits & ((1 << kNumAlignBits) - 1))
        return d

    def match(self, dist, length):
        assert kMatchMinLen <= length <= 273, length
        ps = self.pos_state
        self.rc.encode_bit(self.p_is_match, (self.state << kNumPosBitsMax) + ps, 1)
        self.rc.encode_bit(self.p_is_rep, self.state, 0)          # 非 rep
        lts = min(length - kMatchMinLen, kNumLenToPosStates - 1)
        self._encode_len(self.p_len_choice,
                         self.p_len_low, self.p_len_mid, self.p_len_high, length)
        d = self._write_dist(dist, lts)
        # 状态与 rep 链更新
        self.state = 7 if self.state < kNumLitStates else 10
        self.reps[3], self.reps[2], self.reps[1], self.reps[0] = \
            self.reps[2], self.reps[1], self.reps[0], d
        self.pos += length

    def rep_match(self, length):
        """rep0 匹配：只使用最近一次 match 的距离（quine 构造只需要这种）。"""
        assert kMatchMinLen <= length <= 273, length
        ps = self.pos_state
        self.rc.encode_bit(self.p_is_match, (self.state << kNumPosBitsMax) + ps, 1)
        self.rc.encode_bit(self.p_is_rep, self.state, 1)
        self.rc.encode_bit(self.p_is_rep_g0, self.state, 0)
        self.rc.encode_bit(self.p_rep0_long, (self.state << kNumPosBitsMax) + ps, 1)
        self._encode_len(self.p_rep_len_choice,
                         self.p_rep_len_low, self.p_rep_len_mid, self.p_rep_len_high, length)
        self.state = 8 if self.state < kNumLitStates else 11
        self.pos += length

    def end(self):
        """LZMA 结束标记：编码一个 0 基距离为 0xFFFFFFFF 的 match。"""
        ps = self.pos_state
        self.rc.encode_bit(self.p_is_match, (self.state << kNumPosBitsMax) + ps, 1)
        self.rc.encode_bit(self.p_is_rep, self.state, 0)
        self._encode_len(self.p_len_choice,
                         self.p_len_low, self.p_len_mid, self.p_len_high, kMatchMinLen)
        self._write_dist(0x100000000, 0)
        self.state = 7 if self.state < kNumLitStates else 10

    def finish(self):
        return self.rc.finish()


# ============================================================
# Part 2: 7z 格式原语
# ============================================================

SIG = b"7z\xbc\xaf'\x1c"
VER = b"\x00\x04"
MAX_MATCH = 273                       # LZMA1 单个 match 长度上限
# FILETIME 纪元（1601-01-01）与 Unix 纪元（1970-01-01）之差，单位 100ns
FILETIME_EPOCH_OFFSET = 116444736000000000


def crc32(b, v=0):
    return binascii.crc32(b, v) & 0xFFFFFFFF


def varint(v):
    """7z UINT64 变长编码：首字节高位连续 n 个 1 + 值的 (7-n) 个高位，再跟 n 字节 LE。"""
    if v < 0x80:
        return bytes([v])
    for n in range(1, 9):
        if v < (1 << (8 * n + 7 - n)):
            break
    else:
        raise ValueError("varint too big")
    first = ((0xFF << (8 - n)) & 0xFF) | ((v >> (8 * n)) & ((1 << (7 - n)) - 1))
    return bytes([first]) + (v & ((1 << (8 * n)) - 1)).to_bytes(n, "little")


def store_hdr(payload_len, first=False):
    """LZMA2 uncompressed chunk 头（3 字节，大端 size-1）。"""
    assert 1 <= payload_len <= 65536
    return bytes([0x01 if first else 0x02]) + (payload_len - 1).to_bytes(2, "big")


def matches_for(dist, total):
    """dist 固定、总长 total 的 token 序列：首个 match + 后续 rep0。
    长度按 273 上限切分，并避开"只剩 1 字节"（rep0 最小长度为 2）。"""
    assert total >= 2
    toks = []
    first = min(MAX_MATCH, total)
    if total - first == 1:
        first -= 1
    toks.append(("m", dist, first))
    total -= first
    while total > 0:
        l = min(MAX_MATCH, total)
        if total - l == 1:
            l -= 1
        toks.append(("r0", l))
        total -= l
    return toks


# ============================================================
# Part 3: 多文件 7z quine 构造器
# ============================================================

PROPS_BYTE = 0x5D                      # lc=3, lp=0, pb=2
CHUNK = 65536                          # LZMA2 单 chunk 解压上限
SEED_NOTE = ("\nMayx's Blog!").encode("utf-8")


def dict_prop_for(maxdist):
    """选最小的 LZMA2 dict prop 使字典 >= maxdist。"""
    for p in range(41):
        if (2 | (p & 1)) << (p // 2 + 11) >= maxdist:
            return p, (2 | (p & 1)) << (p // 2 + 11)
    raise ValueError("distance too large")


def lzma_chunk(tokens, out_pos):
    """编一个 LZMA chunk（0xC0: state+props reset，无 dict reset，无 end marker）。
    match token 的编码字节只取决于 (dist,len,pos)，与历史内容无关（不维护输出历史）。"""
    enc = LzmaEncoder()
    enc.pos = out_pos
    total = 0
    for t in tokens:
        if t[0] == "m":
            enc.match(t[1], t[2])
            total += t[2]
        else:
            enc.rep_match(t[1])
            total += t[1]
    data = enc.finish()
    assert total - 1 < 65536 and len(data) - 1 < 65536
    hdr = bytes([0xC0]) + (total - 1).to_bytes(2, "big") + \
          (len(data) - 1).to_bytes(2, "big") + bytes([PROPS_BYTE])
    return hdr + data, total


class BlogQuine:
    def __init__(self, root, quine_name="MayxBlog.7z", seed_name="_quine_seed.bin",
                 src_dir=""):
        self.quine_name = quine_name
        self.seed_name = seed_name
        # 源文件在归档内的前缀目录（如 "src" → 归档内出现 src/hello.txt）；"" = 根目录
        self.src_dir = src_dir.strip("/")
        # 程序运行时间 → FILETIME（1601-01-01 起 100ns 计数），
        # 本次运行只取一次，作为归档内所有文件条目的修改时间字段。
        self.mtime_ft = time.time_ns() // 100 + FILETIME_EPOCH_OFFSET
        # walk_entries: walk 顺序（父先子后、同级 dirs 在前）的 (rel, is_dir)。
        # 子流顺序 = 非空条目在此列表中的顺序，必须自始至终保持同一顺序。
        self.walk_entries = []
        self.files = []       # (relpath, data bytes)，顺序 = walk_entries 中文件序
        # src_dir 的各级父目录先作为目录条目挂入（父先子后），
        # 这样归档结构完整：如 src_dir="public/src" → "public"、"public/src"
        if self.src_dir:
            parts = self.src_dir.split("/")
            for i in range(1, len(parts) + 1):
                self.walk_entries.append(("/".join(parts[:i]), True))
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames.sort()
            for dn in dirnames:
                rel = os.path.relpath(os.path.join(dirpath, dn), root)
                self.walk_entries.append((self._prefixed(rel), True))
            for fn in sorted(filenames):
                p = os.path.join(dirpath, fn)
                rel = os.path.relpath(p, root).replace(os.sep, "/")
                with open(p, "rb") as fp:
                    data = fp.read()
                self.walk_entries.append((self._prefixed(rel), False))
                self.files.append((self._prefixed(rel), data))
        self.dirs = [r for r, isd in self.walk_entries if isd]
        self.content = b"".join(data for _, data in self.files)

    def _prefixed(self, rel):
        return self.src_dir + "/" + rel if self.src_dir else rel

    def entries(self):
        ent = [{"name": self.seed_name, "dir": False}]
        ent += [{"name": r, "dir": isd} for r, isd in self.walk_entries]
        ent.append({"name": self.quine_name, "dir": False})
        return ent

    # ---------- 7z header ----------
    def build_header(self, n, total, d, entries, sub_sizes):
        n_sub = len(sub_sizes)
        N = len(entries)
        h = bytearray()
        h += b"\x01\x04"                                   # kHeader, kMainStreamsInfo
        h += b"\x06" + varint(0) + varint(1) + b"\x09" + varint(n) + b"\x00"  # PackInfo
        h += b"\x07"                                       # UnpackInfo
        h += b"\x0b" + varint(1) + b"\x00"                 # kFolder: 1, local
        h += varint(1) + b"\x21\x21" + varint(1) + bytes([self.dict_prop])
        h += b"\x0c" + varint(d + total)                   # kCodersUnpackSize
        h += b"\x00"                                       # end UnpackInfo
        h += b"\x08"                                       # SubStreamsInfo
        h += b"\x0d" + varint(n_sub)                       # 子流数
        h += b"\x09" + b"".join(varint(s) for s in sub_sizes[:-1])  # 前 n_sub-1 个大小
        h += b"\x0a" + b"\x01"                             # kCRC: AllDefined
        crc_base = len(h)
        h += b"\x00" * (4 * n_sub)                         # CRC 槽（quine 的待定点）
        h += b"\x00\x00"                                   # end SSI, end MainStreamsInfo
        h += b"\x05" + varint(N)                           # FilesInfo
        bits = bytearray((N + 7) // 8)                     # kEmptyStream 位域（MSB 优先）
        for i, e in enumerate(entries):
            if e["dir"]:
                bits[i // 8] |= 1 << (7 - i % 8)
        h += b"\x0e" + varint(len(bits)) + bytes(bits)
        # kMTime：所有条目（文件与目录）写入修改时间（= 本次程序运行时间）
        mt = b"\x01\x00" + struct.pack("<Q", self.mtime_ft) * N
        h += b"\x14" + varint(len(mt)) + mt
        names = bytearray(b"\x00")                         # kName: external=0
        for e in entries:
            names += e["name"].encode("utf-16-le") + b"\x00\x00"
        h += b"\x11" + varint(len(names)) + bytes(names)
        attrs = b"".join(struct.pack("<I", 0x10 if e["dir"] else 0x20)
                         for e in entries)
        h += b"\x15" + varint(2 + len(attrs)) + b"\x01\x00" + attrs  # kAttributes
        h += b"\x00\x00"                                   # end FilesInfo, end Header
        return bytes(h), crc_base

    # ---------- 结构计算 ----------
    def layout(self, d_seed, maxdist_hint):
        content_len = len(self.content)
        d = d_seed + content_len
        # C1 链：k 个 uncompressed chunk，载荷总长 d+35
        Ls = []
        rem = d + 35
        while rem > CHUNK:
            Ls.append(CHUNK)
            rem -= CHUNK
        Ls.append(rem)
        assert Ls[-1] >= 2, "末 chunk 载荷 %d 太小，调整 d_seed" % Ls[-1]
        k = len(Ls)
        hdrA = store_hdr(CHUNK, first=False)               # 0x02 FF FF
        hdrB = store_hdr(Ls[-1], first=False)              # 末 chunk 头（可能与 A 相同）
        self.dict_prop, dict_size = dict_prop_for(maxdist_hint)
        # 子流大小（quine 的 total 在迭代后填）：seed, 各文件, quine
        file_sizes = [len(data) for _, data in self.files]

        T, h = 100, 100
        for _ in range(30):
            chunks = []
            o, f = 0, 32
            S = 0
            for j, L in enumerate(Ls):                     # C1a..C1k
                chunks.append({"kind": "store", "foff": f, "size": 3 + L,
                               "ooff": o, "olen": L, "first": j == 0,
                               "c1": True, "S": S})
                o += L
                f += 3 + L
                S += L
            assert o == d + 35
            # repro：复现 file[35 : 32+3k+d+35) = pay0 hdr1 pay1 ... hdr(k-1) pay(k-1)
            S = 0
            for j, L in enumerate(Ls):
                if j > 0:
                    # chunk j 的 3 字节头：从 seed 开头样本复制
                    srcpos = 0 if (j < k - 1 or L == CHUNK) else 3
                    dist_h = (d + 35 + S + 3 * (j - 1)) - srcpos
                    hb, hu = lzma_chunk([("m", dist_h, 3)], o)
                    assert hu == 3
                    chunks.append({"kind": "lzma", "foff": f, "size": len(hb),
                                   "ooff": o, "olen": hu, "bytes": hb})
                    o += hu
                    f += len(hb)
                # chunk j 的载荷：从 W[S:S+L) 复制
                cb, cu = lzma_chunk(matches_for(d + 35 + 3 * j, L), o)
                assert cu == L
                chunks.append({"kind": "lzma", "foff": f, "size": len(cb),
                               "ooff": o, "olen": cu, "bytes": cb})
                o += cu
                f += len(cb)
                S += L
            # gears: store(x)+copy(x) 把 slip 压到 <=16
            while f - (o - d) > 16:
                s = f - (o - d)
                x = min(s + 3, CHUNK)
                chunks.append({"kind": "store", "foff": f, "size": 3 + x,
                               "ooff": o, "olen": x})
                o += x
                f += 3 + x
                cb, cu = lzma_chunk(matches_for(x, x), o)
                chunks.append({"kind": "lzma", "foff": f, "size": len(cb),
                               "ooff": o, "olen": cu, "bytes": cb})
                o += cu
                f += len(cb)
            # jump: 单 match 从 W[6:6+y)（seed 里的种植串）复制，使 slip = -3
            s = f - (o - d)
            y = s + 17
            for _ in range(10):
                jb, ju = lzma_chunk([("m", o - 6, y)], o)
                y2 = s + 3 + len(jb)
                if y2 == y:
                    break
                y = y2
            assert ju == y and y2 == y, "jump 不动点失败"
            assert y + 6 <= d_seed, "种植串 %d+6 超过 seed %d" % (y, d_seed)
            chunks.append({"kind": "lzma", "foff": f, "size": len(jb),
                           "ooff": o, "olen": ju, "bytes": jb, "jump": True})
            o += ju
            f += len(jb)
            # gadget: 真空 store(T) + match(T,T) + 结束标记
            assert f == (o - d) - 3, "slip=%d 应为 -3" % (f - (o - d))
            chunks.append({"kind": "store", "foff": f, "size": 3 + T,
                           "ooff": o, "olen": T, "vac": True})
            f += 3 + T
            o += T
            gb, gu = lzma_chunk(matches_for(T, T), o)
            assert gu == T
            chunks.append({"kind": "lzma", "foff": f, "size": len(gb),
                           "ooff": o, "olen": gu, "bytes": gb, "gmatch": True})
            f += len(gb)
            o += gu
            # LZMA2 流结束标记（0x00）：7z t 需要它确认流完整结束
            chunks.append({"kind": "term", "foff": f, "size": 1,
                           "ooff": o, "olen": 0, "bytes": b"\x00"})
            f += 1
            n = f - 32
            total = f + h
            sub_sizes = [d_seed] + file_sizes + [total]
            entries = self.entries()
            hdr, crc_base = self.build_header(n, total, d, entries, sub_sizes)
            h_new = len(hdr)
            T_new = len(gb) + 1 + h_new
            if T_new == T and h_new == h:
                assert o == d + f + h, "输出终点 %d != d+total %d" % (o, d + f + h)
                return {"d": d, "d_seed": d_seed, "k": k, "Ls": Ls,
                        "chunks": chunks, "header": hdr, "crc_base": crc_base,
                        "n": n, "total": f + h, "T": T, "h": h,
                        "hdrA": hdrA, "hdrB": hdrB, "jump_y": y,
                        "n_sub": len(sub_sizes), "sub_sizes": sub_sizes,
                        "entries": entries, "dict_size": dict_size}
            T, h = T_new, h_new
        raise RuntimeError("layout 不收敛")

    # ---------- 装配 ----------
    def assemble(self, lay):
        F = bytearray(lay["total"])
        d, h = lay["d"], lay["h"]
        d_seed = lay["d_seed"]
        hoff = lay["total"] - h
        # pass A: sig + 所有非 payload 字节
        F[0:6] = SIG
        F[6:8] = VER
        struct.pack_into("<Q", F, 12, lay["n"])             # NextHeaderOffset
        struct.pack_into("<Q", F, 20, h)                    # NextHeaderSize
        jump_c = vac_c = None
        for c in lay["chunks"]:
            if c["kind"] == "store":
                F[c["foff"]:c["foff"] + 3] = store_hdr(c["olen"],
                                                       first=c.get("first", False))
                if c.get("vac"):
                    vac_c = c
            else:
                F[c["foff"]:c["foff"] + c["size"]] = c["bytes"]
                if c.get("jump"):
                    jump_c = c
        F[hoff:hoff + h] = lay["header"]
        assert jump_c and vac_c
        # pass B: seed = hdrA ‖ hdrB ‖ 种植串 ‖ 填充
        y = lay["jump_y"]
        plant = bytes(F[jump_c["ooff"] - d: jump_c["ooff"] - d + y])
        seed = bytearray(d_seed)
        seed[0:3] = lay["hdrA"]
        seed[3:6] = lay["hdrB"]
        seed[6:6 + y] = plant
        pad = (SEED_NOTE * (d_seed // len(SEED_NOTE) + 2))[:d_seed - 6 - y]
        seed[6 + y:] = pad
        # pass C: 各 store 的 payload
        P = bytes(seed) + self.content + bytes(F[0:35])      # = W[0:d+35)
        assert len(P) == d + 35
        for c in lay["chunks"]:
            if c["kind"] != "store":
                continue
            ooff, olen = c["ooff"], c["olen"]
            if c.get("c1"):
                F[c["foff"] + 3:c["foff"] + 3 + olen] = P[c["S"]:c["S"] + olen]
            elif c.get("vac"):
                fo = ooff - d
                F[fo:fo + olen] = F[fo + olen:fo + 2 * olen]
            else:
                fo = ooff - d
                F[c["foff"] + 3:c["foff"] + 3 + olen] = F[fo:fo + olen]
        return F, bytes(seed)

    # ---------- CRC 定点（96x96 GF(2)） ----------
    def solve_crc(self, F, lay, seed):
        T, h, d = lay["T"], lay["h"], lay["d"]
        k, n_sub, crc_base = lay["k"], lay["n_sub"], lay["crc_base"]
        hoff = lay["total"] - h
        vout_f = lay["total"] - 2 * T
        hcopy = vout_f + (T - h)
        # 已知 CRC：seed + 各文件（quine 的是未知量 D）
        known = [crc32(seed)] + [crc32(data) for _, data in self.files]
        assert len(known) == n_sub - 1
        for i, e in enumerate(known):
            struct.pack_into("<I", F, hoff + crc_base + 4 * i, e)
            struct.pack_into("<I", F, hcopy + crc_base + 4 * i, e)
        # 未知量 D N S，各出现两处
        dpos = crc_base + 4 * (n_sub - 1)
        ncopy = 32 + 3 * k + d                            # C1k 载荷里 F[0:35) 副本起点
        groups = [[hoff + dpos, hcopy + dpos],
                  [28, ncopy + 28],
                  [8, ncopy + 8]]
        Fv = memoryview(F)

        def targets():
            return (crc32(Fv),
                    crc32(Fv[hoff:hoff + h]),
                    crc32(Fv[12:32]))

        base = targets()
        basevec = base[0] | (base[1] << 32) | (base[2] << 64)
        cols = []
        for g in range(3):
            for kb in range(32):
                poss = [p + kb // 8 for p in groups[g]]
                bb = kb % 8
                for p in poss:
                    F[p] ^= (1 << bb)
                t = targets()
                for p in poss:
                    F[p] ^= (1 << bb)
                cols.append((t[0] ^ base[0]) | ((t[1] ^ base[1]) << 32)
                            | ((t[2] ^ base[2]) << 64))
        # (I+A) x = basevec；方程 i: x_i ^ sum_j A[i][j] x_j = base_i
        eqs = []
        for i in range(96):
            coeff = 0
            for j in range(96):
                if (cols[j] >> i) & 1:
                    coeff |= 1 << j
            coeff ^= 1 << i                    # 对角元 = 1 ^ A[i][i]
            eqs.append([coeff, (basevec >> i) & 1])
        for j in range(96):
            p = next((i for i in range(j, 96) if (eqs[i][0] >> j) & 1), None)
            if p is None:
                raise RuntimeError("GF(2) 奇异 @bit%d" % j)
            eqs[j], eqs[p] = eqs[p], eqs[j]
            for i in range(96):
                if i != j and ((eqs[i][0] >> j) & 1):
                    eqs[i][0] ^= eqs[j][0]
                    eqs[i][1] ^= eqs[j][1]
        x = 0
        for i in range(96):
            assert eqs[i][0] == (1 << i)
            if eqs[i][1]:
                x |= 1 << i
        vals = [x & 0xFFFFFFFF, (x >> 32) & 0xFFFFFFFF, (x >> 64) & 0xFFFFFFFF]
        for g in range(3):
            for p in groups[g]:
                F[p:p + 4] = struct.pack("<I", vals[g])
        t = targets()
        assert t == tuple(vals), "CRC 定点失败: %s != %s" % (t, vals)
        return vals

    def build(self, maxdist_hint=None):
        if maxdist_hint is None:
            # 最大距离 ~ jump 的 dist ≈ 2d + repro/gear 余量
            maxdist_hint = 2 * (len(self.content) + 128) + (1 << 21)
        d_seed = 64
        last_err = None
        for _ in range(80):
            d = d_seed + len(self.content)
            if (d + 35) % CHUNK == 1:                     # L_k = 1 无法编 match
                d_seed += 1
                continue
            try:
                lay = self.layout(d_seed, maxdist_hint)
                F, seed = self.assemble(lay)
                crcs = self.solve_crc(F, lay, seed)
                return bytes(F), lay, seed, crcs
            except (RuntimeError, AssertionError) as e:
                last_err = e
                d_seed += 1
        raise RuntimeError("build 多次失败: %s" % last_err)


def verify(F, lay, seed, files):
    """解码 LZMA2 流并逐文件校验。"""
    d, d_seed = lay["d"], lay["d_seed"]
    dec = lzma.LZMADecompressor(
        format=lzma.FORMAT_RAW,
        filters=[{"id": lzma.FILTER_LZMA2, "dict_size": lay["dict_size"]}])
    W = dec.decompress(F[32:32 + lay["n"]])
    assert len(W) == d + len(F), "|W|=%d 期望 %d" % (len(W), d + len(F))
    ok = True
    if W[:d_seed] != seed:
        print("[verify] seed 不匹配")
        ok = False
    pos = d_seed
    for rel, data in files:
        if W[pos:pos + len(data)] != data:
            print("[verify] 文件不匹配:", rel)
            ok = False
        pos += len(data)
    assert pos == d
    if W[d:] != F:
        print("[verify] quine 自复制不匹配")
        ok = False
    print("[verify] 自解码: |W|=%d, seed/文件/quine 全部匹配: %s" % (len(W), ok))
    return ok


def main():
    ap = argparse.ArgumentParser(description="多文件 7z quine 生成器")
    ap.add_argument("srcdir")
    ap.add_argument("output")
    ap.add_argument("--quine-name", default=None,
                    help="归档内 quine 文件名（默认 = output 的文件名）")
    ap.add_argument("--seed-name", default=".this_is_mayx_blog")
    ap.add_argument("--src-dir", default="",
                    help="源文件在归档内的前缀目录（如 src；默认根目录）")
    ap.add_argument("--quine-dir", default="",
                    help="quine 在归档内所在的目录（如 public；默认根目录）")
    args = ap.parse_args()
    quine_name = args.quine_name or os.path.basename(args.output)
    if args.quine_dir:
        # 归档内路径用 / 分隔（与 walk 收集的目录条目一致）
        quine_dir = args.quine_dir.strip("/")
        quine_name = quine_dir + "/" + quine_name

    bq = BlogQuine(args.srcdir, quine_name=quine_name, seed_name=args.seed_name,
                   src_dir=args.src_dir)
    print("[blogquine] %d 个文件, %d 个目录, 内容 %d 字节"
          % (len(bq.files), len(bq.dirs), len(bq.content)))
    F, lay, seed, crcs = bq.build()
    with open(args.output, "wb") as fp:
        fp.write(F)
    print("[blogquine] written %s: %d 字节 (d=%d, k=%d chunks, n=%d, h=%d, T=%d)"
          % (args.output, len(F), lay["d"], lay["k"], lay["n"], lay["h"], lay["T"]))
    print("[blogquine] CRC 定点: D(quine)=%08x N(hdr)=%08x S(sig)=%08x" % tuple(crcs))
    ok = verify(F, lay, seed, bq.files)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
