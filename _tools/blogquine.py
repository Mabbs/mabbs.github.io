#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""LZMA2 7z quine 生成器，仅依赖 Python 标准库。

用法：python blogquine.py 源目录 输出.7z [--quine-name 名称]
                         [--src-dir 前缀目录] [--quine-dir 自身所在目录]
解压得到源文件及输出归档自身；内容原样存储，辅助信息位于归档内部。
"""
import argparse
import binascii
from dataclasses import dataclass
import lzma
import os
from pathlib import Path
import struct
import time

SIG = b"7z\xbc\xaf'\x1c"
VER = b"\x00\x04"
CHUNK = 1 << 16                         # LZMA2 未压缩 chunk 上限
MAX_CHUNK_OUTPUT = 1 << 21              # LZMA2 压缩 chunk 解压上限
MAX_MATCH = 273
PROPS_BYTE = 0x5D                       # lc=3, lp=0, pb=2
FILETIME_EPOCH_OFFSET = 116444736000000000
PROB_INIT = 1024


class RangeEncoder:
    """LZMA 区间编码器；所有整数截断与 SDK 的 UInt32 运算一致。"""

    def __init__(self):
        self.low = 0
        self.range = 0xFFFFFFFF
        self.cache = 0
        self.cache_size = 1
        self.buf = bytearray()

    def _shift_low(self):
        carry = self.low >> 32
        if (self.low & 0xFFFFFFFF) < 0xFF000000 or carry:
            temp = self.cache
            while self.cache_size:
                self.buf.append((temp + carry) & 0xFF)
                temp = 0xFF
                self.cache_size -= 1
            self.cache = (self.low >> 24) & 0xFF
        self.cache_size += 1
        self.low = (self.low << 8) & 0xFFFFFFFF

    def _normalize(self):
        while self.range < 1 << 24:
            self.range = (self.range << 8) & 0xFFFFFFFF
            self._shift_low()

    def encode_bit(self, probs, index, bit):
        probability = probs[index]
        bound = (self.range >> 11) * probability
        if bit:
            self.low += bound
            self.range -= bound
            probs[index] -= probability >> 5
        else:
            self.range = bound
            probs[index] += (2048 - probability) >> 5
        self._normalize()

    def encode_direct_bits(self, value, bits):
        for shift in range(bits - 1, -1, -1):
            self.range >>= 1
            if value >> shift & 1:
                self.low += self.range
            self._normalize()

    def bit_tree(self, probs, offset, bits, symbol, reverse=False):
        node = 1
        shifts = range(bits) if reverse else range(bits - 1, -1, -1)
        for shift in shifts:
            bit = symbol >> shift & 1
            self.encode_bit(probs, offset + node, bit)
            node = (node << 1) | bit

    def finish(self):
        for _ in range(5):
            self._shift_low()
        return bytes(self.buf)


class LengthEncoder:
    """普通 match 和 rep0 使用独立概率，但共享长度编码逻辑。"""

    def __init__(self):
        self.choice = [PROB_INIT] * 2
        self.low = [PROB_INIT] * 32
        self.mid = [PROB_INIT] * 32
        self.high = [PROB_INIT] * 256

    def encode(self, rc, pos_state, length):
        value = length - 2
        rc.encode_bit(self.choice, 0, value >= 8)
        if value < 8:
            rc.bit_tree(self.low, pos_state << 3, 3, value)
        else:
            rc.encode_bit(self.choice, 1, value >= 16)
            if value < 16:
                rc.bit_tree(self.mid, pos_state << 3, 3, value - 8)
            else:
                rc.bit_tree(self.high, 0, 8, value - 16)


class LzmaEncoder:
    """只编码 match/rep0，编码结果不依赖历史字节，供布局后填充数据。"""

    def __init__(self, out_pos=0):
        self.rc = RangeEncoder()
        self.pos = out_pos
        self.state = 0
        self.is_match = [PROB_INIT] * (12 << 4)
        self.is_rep = [PROB_INIT] * 12
        self.is_rep_g0 = [PROB_INIT] * 12
        self.rep0_long = [PROB_INIT] * (12 << 4)
        self.pos_slot = [PROB_INIT] * (4 << 6)
        self.spec_pos = [PROB_INIT] * 114
        self.align = [PROB_INIT] * 16
        self.match_len = LengthEncoder()
        self.rep_len = LengthEncoder()

    def _write_dist(self, dist, length):
        if not 1 <= dist <= 0xFFFFFFFF:
            raise ValueError("LZMA distance must be 1..2^32-1")
        value = dist - 1
        bits = max(0, value.bit_length() - 2)
        slot = value if value < 4 else 2 * (bits + 1) + (value >> bits & 1)
        self.rc.bit_tree(self.pos_slot, min(length - 2, 3) << 6, 6, slot)
        if slot >= 4:
            base = (2 | (slot & 1)) << bits
            extra = value - base
            if slot < 14:
                self.rc.bit_tree(self.spec_pos, base - slot - 1, bits, extra, True)
            else:
                self.rc.encode_direct_bits(extra >> 4, bits - 4)
                self.rc.bit_tree(self.align, 0, 4, extra & 15, True)

    def match(self, dist, length):
        if not 2 <= length <= MAX_MATCH:
            raise ValueError("LZMA match length must be 2..273")
        self.rc.encode_bit(self.is_match, (self.state << 4) + (self.pos & 3), 1)
        self.rc.encode_bit(self.is_rep, self.state, 0)
        self.match_len.encode(self.rc, self.pos & 3, length)
        self._write_dist(dist, length)
        self.state = 7 if self.state < 7 else 10
        self.pos += length

    def rep_match(self, length):
        if not 2 <= length <= MAX_MATCH:
            raise ValueError("LZMA rep0 length must be 2..273")
        index = (self.state << 4) + (self.pos & 3)
        self.rc.encode_bit(self.is_match, index, 1)
        self.rc.encode_bit(self.is_rep, self.state, 1)
        self.rc.encode_bit(self.is_rep_g0, self.state, 0)
        self.rc.encode_bit(self.rep0_long, index, 1)
        self.rep_len.encode(self.rc, self.pos & 3, length)
        self.state = 8 if self.state < 7 else 11
        self.pos += length

    def finish(self):
        return self.rc.finish()


def crc32(data, value=0):
    return binascii.crc32(data, value) & 0xFFFFFFFF


def varint(value):
    """7z UINT64：首字节给出后续小端字节数，最多九字节。"""
    if not 0 <= value < 1 << 64:
        raise ValueError("7z UINT64 out of range")
    for size in range(8):
        if value < 1 << (7 * (size + 1)):
            first = ((0xFF << (8 - size)) & 0xFF) | (value >> (8 * size))
            return bytes([first]) + (value & ((1 << (8 * size)) - 1)).to_bytes(size, "little")
    return b"\xff" + value.to_bytes(8, "little")


def store_hdr(payload_len, first=False):
    if not 1 <= payload_len <= CHUNK:
        raise ValueError("LZMA2 stored chunk must contain 1..65536 bytes")
    return bytes([1 if first else 2]) + (payload_len - 1).to_bytes(2, "big")


def matches_for(dist, total):
    """固定距离的首个 match 加 rep0；分段时不留下单字节。"""
    if total < 2:
        raise ValueError("match sequence must output at least two bytes")
    tokens = []
    while total:
        length = min(MAX_MATCH, total)
        if total - length == 1:
            length -= 1
        tokens.append(("r0", length) if tokens else ("m", dist, length))
        total -= length
    return tokens


def dict_prop_for(maxdist):
    for prop in range(41):
        size = 0xFFFFFFFF if prop == 40 else (2 | (prop & 1)) << (prop // 2 + 11)
        if size >= maxdist:
            return prop, size
    raise ValueError("LZMA2 dictionary distance exceeds 2^32-1")


def lzma_chunk(tokens, out_pos):
    """重置状态和概率，保留字典；21-bit 解压长度，不写结束标记。"""
    enc = LzmaEncoder(out_pos)
    for token in tokens:
        if token[0] == "m":
            enc.match(token[1], token[2])
        elif token[0] == "r0":
            enc.rep_match(token[1])
        else:
            raise ValueError("unsupported LZMA token: %r" % (token[0],))
    data = enc.finish()
    total = enc.pos - out_pos
    if not 1 <= total <= MAX_CHUNK_OUTPUT or not 1 <= len(data) <= CHUNK:
        raise ValueError("LZMA2 compressed chunk size out of range")
    unpacked, packed = total - 1, len(data) - 1
    header = (bytes([0xC0 | (unpacked >> 16)])
              + (unpacked & 0xFFFF).to_bytes(2, "big")
              + packed.to_bytes(2, "big") + bytes([PROPS_BYTE]))
    return header + data, total


@dataclass(frozen=True)
class Entry:
    name: str
    is_dir: bool
    data: bytes = b""


@dataclass(frozen=True)
class Layout:
    prefix_size: int
    chunks: tuple
    samples: bytes
    padding: int
    matches: bytes
    header: bytes
    crc_offset: int
    dict_size: int

    @property
    def packed_size(self):
        return sum(self.chunks) + 3 * len(self.chunks) + len(self.matches) + 1


class LayoutError(RuntimeError):
    """当前填充量没有满足布局或 CRC 定点，换一个填充量重试。"""


def split_sizes(size, limit):
    """每片至少两字节，避免 match 无法表达的一字节尾片。"""
    if size < 2:
        raise ValueError("分片总长度必须至少为 2")
    sizes = [limit] * (size // limit)
    tail = size % limit
    if tail == 1:
        sizes[-1] -= 1
        tail = 2
    if tail:
        sizes.append(tail)
    return tuple(sizes)


def bitfield(flags):
    data = bytearray((len(flags) + 7) // 8)
    for i, flag in enumerate(flags):
        if flag:
            data[i // 8] |= 1 << (7 - i % 8)
    return bytes(data)


def archive_path(value, allow_empty=False):
    value = value.replace("\\", "/")
    if not value and allow_empty:
        return ""
    parts = value.split("/")
    if any(part in ("", ".", "..") for part in parts) or any(c in value for c in ("\0", ":")):
        raise ValueError("归档内路径必须是相对路径，不能包含空段、. 或 ..：%r" % value)
    return "/".join(parts)


def encode_segments(segments, out_pos):
    """把 (历史起点, 长度) 转成 match 流；跨 chunk 时保留字典。"""
    result, tokens = bytearray(), []
    used, max_distance = 0, 0
    for source, length in segments:
        for size in split_sizes(length, MAX_CHUNK_OUTPUT):
            if used + size > MAX_CHUNK_OUTPUT:
                block, _ = lzma_chunk(tokens, out_pos)
                result += block
                out_pos += used
                tokens, used = [], 0
            distance = out_pos + used - source
            if distance <= 0:
                raise LayoutError("回引源尚未输出")
            max_distance = max(max_distance, distance)
            tokens.extend(matches_for(distance, size))
            used += size
            source += size
    if tokens:
        block, _ = lzma_chunk(tokens, out_pos)
        result += block
    return bytes(result), max_distance


def solve_fixed_crc(data, groups, targets):
    """CRC 是 GF(2) 仿射函数；同步所有镜像，解三个 CRC 的 96-bit 定点。"""
    def vector(values):
        return sum(value << (32 * i) for i, value in enumerate(values))

    base = vector(targets())
    columns = []
    for copies in groups:
        for bit in range(32):
            positions = [copy[bit // 8] for copy in copies]
            for pos in positions:
                data[pos] ^= 1 << (bit % 8)
            columns.append(vector(targets()) ^ base)
            for pos in positions:
                data[pos] ^= 1 << (bit % 8)

    rows = []
    for bit in range(96):
        coeff = 1 << bit
        for j, column in enumerate(columns):
            coeff ^= ((column >> bit) & 1) << j
        rows.append([coeff, (base >> bit) & 1])
    pivots = []
    for column in range(96):
        rank = len(pivots)
        pivot = next((i for i in range(rank, 96) if rows[i][0] >> column & 1), None)
        if pivot is None:
            continue
        rows[rank], rows[pivot] = rows[pivot], rows[rank]
        for i in range(96):
            if i != rank and rows[i][0] >> column & 1:
                rows[i][0] ^= rows[rank][0]
                rows[i][1] ^= rows[rank][1]
        pivots.append(column)
    if any(not coeff and rhs for coeff, rhs in rows):
        raise LayoutError("CRC 定点方程无解")
    solution = sum(rows[i][1] << column for i, column in enumerate(pivots))
    values = [(solution >> (32 * i)) & 0xFFFFFFFF for i in range(3)]
    for copies, value in zip(groups, values):
        packed = struct.pack("<I", value)
        for copy in copies:
            for i, pos in enumerate(copy):
                data[pos] = packed[i]
    if tuple(values) != targets():
        raise RuntimeError("CRC 定点校验失败")


class BlogQuine:
    """单层 LZMA2：解码(P) = content || Q，无独立的辅助文件条目。

    Q = V || P || H，V = S32 || H副本 || chunk头样本 || pad || M副本 || 00。
    P 先 store(content || V)，再由 M 回引已输出的字节，复现 P || H。
    内容按原样存储；M 的编码不依赖历史字节，可先求布局，再填头部与 CRC。
    """

    def __init__(self, root, quine_name="MayxBlog.7z", src_dir="", exclude=None):
        root = Path(root).resolve()
        if not root.is_dir():
            raise ValueError("源目录不存在：%s" % root)
        self.quine_name = archive_path(quine_name)
        prefix = archive_path(src_dir.strip("/\\"), allow_empty=True)
        excluded = Path(exclude).resolve() if exclude is not None else None
        self.entries, self.files = [], []
        names = {}

        def add(name, is_dir, data=b""):
            key = name.casefold()
            if key in names:
                if is_dir and names[key].is_dir and names[key].name == name:
                    return
                raise ValueError("归档内路径冲突：%s" % name)
            entry = Entry(name, is_dir, data)
            names[key] = entry
            self.entries.append(entry)
            if not is_dir:
                self.files.append(entry)

        def add_parents(name):
            parts = name.split("/")
            for i in range(1, len(parts)):
                add("/".join(parts[:i]), True)

        if prefix:
            add_parents(prefix)
            add(prefix, True)

        def walk_error(error):
            raise error

        for directory, dirs, files in os.walk(root, onerror=walk_error):
            dirs.sort()
            children = [(name, True) for name in dirs]
            children += [(name, False) for name in sorted(files)]
            for name, is_dir in children:
                path = Path(directory) / name
                if not is_dir and path.resolve() == excluded:
                    continue
                rel = path.relative_to(root).as_posix()
                name = archive_path(prefix + "/" + rel if prefix else rel)
                add_parents(name)
                add(name, is_dir, b"" if is_dir else path.read_bytes())

        add_parents(self.quine_name)
        if self.quine_name.casefold() in names:
            raise ValueError("quine 文件名与源条目冲突：%s" % self.quine_name)
        self.entries.append(Entry(self.quine_name, False))
        self.content = b"".join(entry.data for entry in self.files)
        self.stream_files = [entry for entry in self.files if entry.data]
        self.stream_sizes = b"".join(varint(len(entry.data)) for entry in self.stream_files)
        self.stream_crcs = b"".join(struct.pack("<I", crc32(entry.data)) for entry in self.stream_files)
        self.mtime = time.time_ns() // 100 + FILETIME_EPOCH_OFFSET

    def build_header(self, prefix_size, packed_size, archive_size, dict_prop):
        h = bytearray(b"\x01\x04\x06" + varint(prefix_size - 32)
                      + b"\x01\x09" + varint(packed_size) + b"\x00\x07\x0b\x01\x00")
        h += b"\x01\x21\x21\x01" + bytes([dict_prop])  # 一个 LZMA2 coder
        h += b"\x0c" + varint(len(self.content) + archive_size) + b"\x00"
        h += b"\x08\x0d" + varint(len(self.stream_files) + 1) + b"\x09" + self.stream_sizes
        h += b"\x0a\x01" + self.stream_crcs
        crc_offset = len(h)
        h += b"\x00" * 4 + b"\x00\x00\x05" + varint(len(self.entries))

        def prop(kind, data):
            return bytes([kind]) + varint(len(data)) + data

        empty = [entry.is_dir or (not entry.data and i != len(self.entries) - 1)
                 for i, entry in enumerate(self.entries)]
        h += prop(0x0E, bitfield(empty))
        if any(flag and not entry.is_dir for flag, entry in zip(empty, self.entries)):
            empty_files = [not entry.is_dir for flag, entry in zip(empty, self.entries) if flag]
            h += prop(0x0F, bitfield(empty_files))
        h += prop(0x14, b"\x01\x00" + struct.pack("<Q", self.mtime) * len(self.entries))
        names = b"".join(entry.name.encode("utf-16-le") + b"\x00\x00" for entry in self.entries)
        attrs = b"".join(struct.pack("<I", 0x10 if entry.is_dir else 0x20) for entry in self.entries)
        h += prop(0x11, b"\x00" + names)
        h += prop(0x15, b"\x01\x00" + attrs)
        return bytes(h + b"\x00\x00"), crc_offset

    def layout(self, padding):
        header_size, match_size = 256, 256
        seen = set()
        dc = len(self.content)
        for _ in range(40):
            prefix_size = 32 + header_size + 12 + padding + match_size + 1
            output_size = dc + prefix_size
            chunks = split_sizes(output_size, CHUNK)
            samples = (store_hdr(chunks[0], True) + store_hdr(CHUNK)
                       + store_hdr(CHUNK - 1) + store_hdr(chunks[-1]))
            segments, offset = [], 0
            for i, size in enumerate(chunks):
                sample = 0 if i == 0 else 1 if size == CHUNK else 2 if size == CHUNK - 1 else 3
                segments += [(dc + 32 + header_size + 3 * sample, 3), (offset, size)]
                offset += size
            segments += [(dc + 32 + header_size + 12 + padding, match_size + 1),
                         (dc + 32, header_size)]
            matches, max_distance = encode_segments(segments, output_size)
            dict_prop, dict_size = dict_prop_for(max_distance)
            packed_size = output_size + 3 * len(chunks) + len(matches) + 1
            header, crc_offset = self.build_header(
                prefix_size, packed_size, prefix_size + packed_size + header_size, dict_prop)
            key = len(header), len(matches)
            if key == (header_size, match_size):
                return Layout(prefix_size, chunks, samples, padding, matches,
                              header, crc_offset, dict_size)
            if key in seen:
                break
            seen.add(key)
            header_size, match_size = key
        raise LayoutError("布局没有收敛")

    def assemble(self, layout):
        start = struct.pack("<QQI", layout.prefix_size - 32 + layout.packed_size,
                            len(layout.header), 0)
        signature = SIG + VER + b"\x00" * 4 + start
        prefix = (signature + layout.header + layout.samples + b"\x00" * layout.padding
                  + layout.matches + b"\x00")
        initial = self.content + prefix
        data, offset = bytearray(prefix), 0
        for i, size in enumerate(layout.chunks):
            data += store_hdr(size, first=i == 0) + initial[offset:offset + size]
            offset += size
        data += layout.matches + b"\x00" + layout.header
        if len(prefix) != layout.prefix_size or offset != len(initial):
            raise RuntimeError("装配布局不一致")

        def stored_positions(output_offset, size):
            result, consumed, physical = [], 0, layout.prefix_size
            for length in layout.chunks:
                begin = max(output_offset, consumed)
                end = min(output_offset + size, consumed + length)
                result.extend(range(physical + 3 + begin - consumed, physical + 3 + end - consumed))
                consumed += length
                physical += 3 + length
            if len(result) != size:
                raise RuntimeError("无法定位 store 载荷")
            return result

        slot = layout.crc_offset
        hoff = layout.prefix_size + layout.packed_size
        groups = [[list(range(32 + slot, 36 + slot)),
                   stored_positions(len(self.content) + 32 + slot, 4),
                   list(range(hoff + slot, hoff + slot + 4))]]
        for slot in (28, 8):
            groups.append([list(range(slot, slot + 4)), stored_positions(len(self.content) + slot, 4)])
        view = memoryview(data)
        solve_fixed_crc(data, groups, lambda: (crc32(view), crc32(view[hoff:]), crc32(view[12:32])))
        return bytes(data)

    def verify(self, data, layout):
        dec = lzma.LZMADecompressor(format=lzma.FORMAT_RAW,
            filters=[{"id": lzma.FILTER_LZMA2, "dict_size": layout.dict_size}])
        expected = len(self.content) + len(data)
        packed = data[layout.prefix_size:layout.prefix_size + layout.packed_size]
        decoded = dec.decompress(packed, max_length=expected + 1)
        view = memoryview(decoded)
        if (not dec.eof or dec.unused_data or len(decoded) != expected
                or view[:len(self.content)] != self.content or view[len(self.content):] != data):
            raise RuntimeError("自解码校验失败")

    def build(self):
        last_error = None
        for padding in range(256):
            try:
                layout = self.layout(padding)
                data = self.assemble(layout)
                self.verify(data, layout)
                return data
            except LayoutError as error:
                last_error = error
        raise RuntimeError("无法找到布局/CRC 定点：%s" % last_error)


def main():
    parser = argparse.ArgumentParser(description="LZMA2 7z quine 生成器")
    parser.add_argument("srcdir", help="要打包的源目录")
    parser.add_argument("output", help="输出的 7z 文件")
    parser.add_argument("--quine-name", help="归档内自身文件名，默认使用输出文件名")
    parser.add_argument("--src-dir", default="", help="源文件在归档内的前缀目录")
    parser.add_argument("--quine-dir", default="", help="归档内自身文件所在目录")
    args = parser.parse_args()
    try:
        output = Path(args.output)
        name = args.quine_name or output.name
        if args.quine_dir:
            name = archive_path(args.quine_dir.strip("/\\")) + "/" + name
        quine = BlogQuine(args.srcdir, name, args.src_dir, exclude=output)
        data = quine.build()  # 验证成功后才写出，失败时保留已有输出。
        output.write_bytes(data)
    except (OSError, ValueError, RuntimeError, lzma.LZMAError) as error:
        parser.exit(1, "blogquine: %s\n" % error)
    print("[blogquine] %d 个文件，%d 个目录，内容 %d 字节" %
          (len(quine.files), sum(entry.is_dir for entry in quine.entries), len(quine.content)))
    print("[blogquine] 已写入 %s：%d 字节；自解码通过" % (output, len(data)))


if __name__ == "__main__":
    main()
