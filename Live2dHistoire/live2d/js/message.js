var userAgent = window.navigator.userAgent.toLowerCase();
console.log(userAgent);
var norunAI = ["android", "iphone", "ipod", "ipad", "windows phone"];
var norunFlag = false;


for (var i = 0; i < norunAI.length; i++) {
	if (userAgent.indexOf(norunAI[i]) > -1) {
		norunFlag = true;
		break;
	}
}

if (!window.WebGLRenderingContext) {
	norunFlag = true;
}

if (!norunFlag) {
	var hitFlag = false;
	var AIFadeFlag = false;
	var liveTlakTimer = null;
	var sleepTimer_ = null;
	var AITalkFlag = false;
	var talkNum = 0;
	// 暴露到全局，供 pjax.js 在页面切换后重新调用
	window._live2d = { initTips: null, showMessage: null, showHitokoto: null };
	(function () {
		function renderTip(template, context) {
			var tokenReg = /(\\)?\{([^\{\}\\]+)(\\)?\}/g;
			return template.replace(tokenReg, function (word, slash1, token, slash2) {
				if (slash1 || slash2) {
					return word.replace(/\\/g, '');
				}
				var variables = token.replace(/\s/g, '').split('.');
				var currentObject = context;
				var i, length, variable;
				for (i = 0, length = variables.length; i < length; ++i) {
					variable = currentObject[variables[i]];
					if (variable === undefined || variable === null) return '';
					currentObject = variable;
				}
				return String(currentObject);
			});
		}

		String.prototype.renderTip = function (context) {
			return renderTip(this, context);
		};

		var re = /x/;
		console.log(re);
		re.toString = function () {
			showMessage('哈哈，你打开了控制台，是想要看看我的秘密吗？', 5000);
			return '';
		};

		$(document).on('copy', function () {
			showMessage('你都复制了些什么呀，转载要记得加上出处哦~~', 5000);
		});

		// 缓存 message.json 数据，供 PJAX 重绑定使用
		var tipsData = null;

		function initTips() {
			$.ajax({
				cache: true,
				url: message_Path + 'message.json',
				dataType: "json",
				success: function (result) {
					tipsData = result;
					// 解绑旧事件（用命名空间避免影响其他绑定）
					$.each(result.mouseover, function (index, tips) {
						$(tips.selector).off('mouseover._live2d_tips mouseout._live2d_tips');
						$(tips.selector).on('mouseover._live2d_tips', function () {
							var text = tips.text;
							if (Array.isArray(tips.text)) text = tips.text[Math.floor(Math.random() * tips.text.length + 1) - 1];
							text = text.renderTip({ text: $(this).text() });
							showMessage(text, 3000);
							talkValTimer();
							clearInterval(liveTlakTimer);
							liveTlakTimer = null;
						});
						$(tips.selector).on('mouseout._live2d_tips', function () {
							showHitokoto();
							if (liveTlakTimer == null) {
								liveTlakTimer = window.setInterval(function () {
									showHitokoto();
								}, 15000);
							};
						});
					});
					$.each(result.click, function (index, tips) {
						$(tips.selector).off('click._live2d_tips');
						$(tips.selector).on('click._live2d_tips', function () {
							if (hitFlag) {
								return false
							}
							hitFlag = true;
							setTimeout(function () {
								hitFlag = false;
							}, 8000);
							var text = tips.text;
							if (Array.isArray(tips.text)) text = tips.text[Math.floor(Math.random() * tips.text.length + 1) - 1];
							text = text.renderTip({ text: $(this).text() });
							showMessage(text, 3000);
						});
						clearInterval(liveTlakTimer);
						liveTlakTimer = null;
						if (liveTlakTimer == null) {
							liveTlakTimer = window.setInterval(function () {
								showHitokoto();
							}, 15000);
						};
					});
				}
			});
		}
		window._live2d.initTips = initTips;
		initTips();

		var text;
		if (document.referrer !== '' && document.referrer.split('/')[2] !== window.location.host) {
			var referrer = document.createElement('a');
			referrer.href = document.referrer;
			var domain = referrer.hostname.split('.')[1];
			if (domain == 'baidu' || domain == 'so' || domain == 'google') {
				var source = domain == 'baidu' ? '百度搜索' : domain == 'so' ? '360搜索' : '谷歌搜索';
				text = '嗨！ 来自 ' + source + ' 的朋友！<br>欢迎访问<span style="color:#0099cc;">「 ' + document.title.split(' | ')[0] + ' 」</span>';
			} else {
				text = '嗨！来自 <span style="color:#0099cc;">' + referrer.hostname + '</span> 的朋友！';
			}
		} else {
			text = getWelcomeText();
		}
		showMessage(text, 12000);
	})();

	liveTlakTimer = setInterval(function () {
		showHitokoto();
	}, 15000);

	function showHitokoto() {
		if (sessionStorage.getItem("Sleepy") !== "1") {
			if (!AITalkFlag) {
				$.getJSON('https://hitokoto.mayx.eu.org/', function (result) {
					talkValTimer();
					showMessage(result.hitokoto, 0);
				});
			}
		} else {
			hideMessage(0);
			if (sleepTimer_ == null) {
				sleepTimer_ = setInterval(function () {
					checkSleep();
				}, 200);
			}
			console.log(sleepTimer_);
		}
	}
	window._live2d.showHitokoto = showHitokoto;

	function checkSleep() {
		var sleepStatu = sessionStorage.getItem("Sleepy");
		if (sleepStatu !== '1') {
			talkValTimer();
			showMessage('你回来啦~', 0);
			clearInterval(sleepTimer_);
			sleepTimer_ = null;
		}
	}

	function showMessage(text, timeout) {
		if (Array.isArray(text)) text = text[Math.floor(Math.random() * text.length + 1) - 1];
		//console.log('showMessage', text);
		$('.message').stop();
		if (typeof EventSource !== 'undefined' && text instanceof EventSource) {
			var outputContainer = $('.message')[0];
			var eventFlag = false;
			text.onmessage = function (event) {
				if (event.data == "[DONE]") {
					text.close();
					return;
				} else {
					if (!eventFlag) {
						talkValTimer();
						outputContainer.textContent = "";
						eventFlag = true;
					}
					var data = JSON.parse(event.data);
					if (data.response) {
						outputContainer.textContent += data.response;
					}
				}
			}
		} else {
			$('.message').html(text);
		}
		$('.message').fadeTo(200, 1);
		//if (timeout === null) timeout = 5000;
		//hideMessage(timeout);
	}
	window._live2d.showMessage = showMessage;
	function talkValTimer() {
		$('#live_talk').val('1');
	}

	function hideMessage(timeout) {
		//$('.message').stop().css('opacity',1);
		if (timeout === null) timeout = 5000;
		$('.message').delay(timeout).fadeTo(200, 0);
	}

	function initLive2d() {
		$("#landlord").mouseenter(function () {
			$(".live_ico_box").fadeIn();
		});
		$("#landlord").mouseleave(function () {
			$(".live_ico_box").fadeOut();
		});
		$('#hideButton').on('click', function () {
			if (AIFadeFlag) {
				return false;
			} else {
				AIFadeFlag = true;
				localStorage.setItem("live2dhidden", "0");
				$('#landlord').fadeOut(200);
				$('#open_live2d').delay(200).fadeIn(200);
				setTimeout(function () {
					AIFadeFlag = false;
				}, 300);
			}
		});
		$('#open_live2d').on('click', function () {
			if (AIFadeFlag) {
				return false;
			} else {
				AIFadeFlag = true;
				localStorage.setItem("live2dhidden", "1");
				$('#open_live2d').fadeOut(200);
				$('#landlord').delay(200).fadeIn(200);
				setTimeout(function () {
					AIFadeFlag = false;
				}, 300);
			}
		});
		$('#youduButton').on('click', function () {
			if ($('#youduButton').hasClass('doudong')) {
				var typeIs = $('#youduButton').attr('data-type');
				$('#youduButton').removeClass('doudong');
				$('body').removeClass(typeIs);
				$('#youduButton').attr('data-type', '');
			} else {
				var duType = $('#duType').val();
				var duArr = duType.split(",");
				var dataType = duArr[Math.floor(Math.random() * duArr.length)];

				$('#youduButton').addClass('doudong');
				$('#youduButton').attr('data-type', dataType);
				$('body').addClass(dataType);
			}
		});
		if (talkAPI !== "" && typeof EventSource !== 'undefined') {
			$('#showInfoBtn').on('click', function () {
				var live_statu = $('#live_statu_val').val();
				if (live_statu == "0") {
					return
				} else {
					$('#live_statu_val').val("0");
					$('.live_talk_input_body').fadeOut(500);
					AITalkFlag = false;
					showHitokoto();
					$('#showTalkBtn').show();
					$('#showInfoBtn').hide();
				}
			});
			$('#showTalkBtn').on('click', function () {
				var live_statu = $('#live_statu_val').val();
				if (live_statu == "1") {
					return
				} else {
					$('#live_statu_val').val("1");
					$('.live_talk_input_body').fadeIn(500);
					AITalkFlag = true;
					$('#showTalkBtn').hide();
					$('#showInfoBtn').show();

				}
			});
			$('#live_talk_input_form').on('submit', function (e) {
				e.preventDefault();
				var info_ = $('#AIuserText').val();
				// var userid_ = $('#AIuserName').val();
				let add_id = "";
				if ($('#load_this').prop("checked")) {
					add_id = "&id=" + encodeURIComponent($('#post_id').val());
				}
				if (info_ == "") {
					showMessage('写点什么吧！', 0);
					return;
				}
				showMessage('思考中~', 0);
				showMessage(new EventSource(talkAPI + "?info=" + encodeURIComponent(info_) + add_id));
			});
		} else {
			$('#showInfoBtn').hide();
			$('#showTalkBtn').hide();

		}
		// //获取用户名
		// var live2dUser = sessionStorage.getItem("live2duser");
		// if(live2dUser !== null){
		// 	$('#AIuserName').val(live2dUser);
		// }
		//获取位置
		var landL = sessionStorage.getItem("historywidth");
		var landB = sessionStorage.getItem("historyheight");
		if (landL == null || landB == null) {
			landL = '5px'
			landB = '0px'
		}
		$('#landlord').css('left', landL + 'px');
		$('#landlord').css('bottom', landB + 'px');
		//移动
		function getEvent() {
			return window.event || arguments.callee.caller.arguments[0];
		}
		var smcc = document.getElementById("landlord");
		var moveX = 0;
		var moveY = 0;
		var moveBottom = 0;
		var moveLeft = 0;
		var moveable = false;
		var docMouseMoveEvent = document.onmousemove;
		var docMouseUpEvent = document.onmouseup;
		smcc.onmousedown = function () {
			var ent = getEvent();
			moveable = true;
			moveX = ent.clientX;
			moveY = ent.clientY;
			var obj = smcc;
			moveBottom = parseInt(obj.style.bottom);
			moveLeft = parseInt(obj.style.left);
			if (isFirefox = navigator.userAgent.indexOf("Firefox") > 0) {
				window.getSelection().removeAllRanges();
			}
			document.onmousemove = function () {
				if (moveable) {
					var ent = getEvent();
					var x = moveLeft + ent.clientX - moveX;
					var y = moveBottom + (moveY - ent.clientY);
					obj.style.left = x + "px";
					obj.style.bottom = y + "px";
				}
			};
			document.onmouseup = function () {
				if (moveable) {
					var historywidth = obj.style.left;
					var historyheight = obj.style.bottom;
					historywidth = historywidth.replace('px', '');
					historyheight = historyheight.replace('px', '');
					sessionStorage.setItem("historywidth", historywidth);
					sessionStorage.setItem("historyheight", historyheight);
					document.onmousemove = docMouseMoveEvent;
					document.onmouseup = docMouseUpEvent;
					moveable = false;
					moveX = 0;
					moveY = 0;
					moveBottom = 0;
					moveLeft = 0;
				}
			};
		};
		//获取音乐信息初始化
		var $bgm = $('#live2d_bgm');

		// 音乐按钮点击事件（幂等，使用命名空间避免重复绑定）
		$('#musicButton').off('click._bgm').on('click._bgm', function () {
			if ($('#musicButton').hasClass('play')) {
				$bgm[0].pause();
				$('#musicButton').removeClass('play');
				sessionStorage.setItem("live2dBGM_IsPlay", '1');
			} else {
				$bgm[0].play();
				$('#musicButton').addClass('play');
				sessionStorage.setItem("live2dBGM_IsPlay", '0');
			}
		});

		// BGM 事件监听（仅绑定一次，使用标志位避免重复）
		if (!window._live2d._bgmEventsBound) {
			$bgm[0].addEventListener("timeupdate", function () {
				sessionStorage.setItem("live2dBGM_PlayTime", $bgm[0].currentTime);
			});
			$bgm[0].addEventListener("ended", function () {
				var listNow = parseInt($bgm.attr('data-bgm'));
				listNow++;
				var inputs = $('input[name=live2dBGM]');
				if (inputs.length === 0) return;
				if (listNow > inputs.length - 1) {
					listNow = 0;
				}
				var listNewSrc = inputs.eq(listNow).val();
				if (!listNewSrc) return;
				sessionStorage.setItem("live2dBGM_Num", listNow);
				$bgm.attr('src', listNewSrc);
				$bgm[0].play();
				$bgm.attr('data-bgm', listNow);
			});
			$bgm[0].addEventListener("error", function () {
				$bgm[0].pause();
				$('#musicButton').removeClass('play');
				showMessage('音乐似乎加载不出来了呢！', 0);
			});
			window.onbeforeunload = function () {
				sessionStorage.setItem("live2dBGM_WindowClose", '0');
				if ($('#musicButton').hasClass('play')) {
					sessionStorage.setItem("live2dBGM_IsPlay", '0');
				}
			};
			window._live2d._bgmEventsBound = true;
		}

		// 初始化 BGM（根据当前页面是否有 BGM 输入）
		if (typeof window._live2d.initBGM === 'function') {
			window._live2d.initBGM();
		}
	}

	// 暴露 BGM 初始化函数，供 PJAX 重初始化时调用
	window._live2d.initBGM = function() {
		var bgmListInfo = $('input[name=live2dBGM]');
		var $bgm = $('#live2d_bgm');
		if (bgmListInfo.length === 0) {
			$('#musicButton').hide();
			if ($bgm.length) $bgm[0].pause();
			return;
		}
		var bgmPlayNow = parseInt($bgm.attr('data-bgm')) || 0;
		var bgmPlayTime = 0;
		var live2dBGM_Num = sessionStorage.getItem("live2dBGM_Num");
		var live2dBGM_PlayTime = sessionStorage.getItem("live2dBGM_PlayTime");
		if (live2dBGM_Num) {
			if (parseInt(live2dBGM_Num) <= bgmListInfo.length - 1) {
				bgmPlayNow = parseInt(live2dBGM_Num);
			}
		}
		if (live2dBGM_PlayTime) {
			bgmPlayTime = parseFloat(live2dBGM_PlayTime);
		}
		var newSrc = bgmListInfo.eq(bgmPlayNow).val();
		$bgm.attr('data-bgm', bgmPlayNow);
		if ($bgm.attr('src') !== newSrc) {
			$bgm[0].pause();
			$bgm.attr('src', newSrc);
			$bgm[0].currentTime = bgmPlayTime;
		}
		$bgm[0].volume = 0.5;
		var live2dBGM_IsPlay = sessionStorage.getItem("live2dBGM_IsPlay");
		var live2dBGM_WindowClose = sessionStorage.getItem("live2dBGM_WindowClose");
		if (live2dBGM_IsPlay == '0' && live2dBGM_WindowClose == '0') {
			$bgm[0].play();
			$('#musicButton').addClass('play');
		}
		sessionStorage.setItem("live2dBGM_WindowClose", '1');
		$('#musicButton').show();
	};

	$(document).ready(function () {
		var AIimgSrc = [
			message_Path + "model/histoire/histoire.1024/texture_00.png",
			message_Path + "model/histoire/histoire.1024/texture_01.png",
			message_Path + "model/histoire/histoire.1024/texture_02.png",
			message_Path + "model/histoire/histoire.1024/texture_03.png"
		]
		var images = [];
		var imgLength = AIimgSrc.length;
		var loadingNum = 0;
		for (var i = 0; i < imgLength; i++) {
			images[i] = new Image();
			images[i].src = AIimgSrc[i];
			images[i].onload = function () {
				loadingNum++;
				if (loadingNum === imgLength) {
					var live2dhidden = localStorage.getItem("live2dhidden");
					if (live2dhidden === "0") {
						setTimeout(function () {
							$('#open_live2d').fadeIn(200);
						}, 1300);
					} else {
						setTimeout(function () {
							$('#landlord').fadeIn(200);
						}, 1300);
					}
					setTimeout(function () {
						loadlive2d("live2d", message_Path + "model/histoire/model.json");
					}, 1000);
					initLive2d();
					images = null;
				}
			}
		}
	});
}
