/* =========================================================================
   星光阁楼 · Starlight Loft
   -------------------------------------------------------------------------
   纯程序化 3D 场景（除 three.js 外无任何外部图片 / 模型）：
   暖橙色木质阁楼 · 梵高风挂画墙 · 楼梯 + 阁楼格栅栏杆 · 灯串
   石墙壁龛 · 拱窗 · 龟背竹 / 向日葵盆栽 · 橙垫沙发 · 圆木桌
   白猫 · 礼物盒 · 留声机 · 画架 · 花瓣地垫

   交互：拖动旋转 / 滚轮或双指缩放 / 点击 8 个物件触发惊喜
   ========================================================================= */
(function () {
  'use strict';

  var T = THREE;

  /* =======================================================================
     0. 配置
     ======================================================================= */
  var CONFIG = {
    room: { w: 12.6, d: 10.4, h: 6.2, t: 0.36 },
    camera: { fitRadius: 3.12 },
    autoSound: true,

    items: [
      { id: 'sofa',   name: '沙发',   text: '这里永远留一个位置给你，<br/>坐多久都可以。' },
      { id: 'gramo',  name: '唱片机', text: '点我开始播放，<br/>今晚的歌，单曲循环。' },
      { id: 'cat',    name: '小猫',   text: '它守着这间屋子，<br/>也守着你。' },
      { id: 'gift',   name: '礼物盒', text: '先别急着拆，<br/>许个愿吧。' },
      { id: 'window', name: '窗',     text: '窗外的夜色，<br/>是今晚的第一份礼物。' },
      { id: 'book',   name: '桌上的书', text: '读到第二十一页就停了，<br/>等你回来一起读。' },
      { id: 'flower', name: '花',     text: '花开得刚好，<br/>像今天。' },
      { id: 'lights', name: '灯串',   text: '把一整个夜晚，<br/>都送给你。' }
    ]
  };

  var ROOM = CONFIG.room;
  var HW = ROOM.w / 2, HD = ROOM.d / 2;
  var TARGET = new T.Vector3(0.25, 1.96, -1.1);

  var clamp = T.MathUtils.clamp;
  var lerp = T.MathUtils.lerp;
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var randInt = function (a, b) { return Math.floor(rand(a, b + 1)); };
  var pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };

  /* 画框几何缓存 / 木色轮换计数（需在使用前初始化） */
  var _frameGeoCache = {}, _frameTone = 0;

  /* 可交互物件池 / id 映射（register 在构建期即被调用，需提前初始化） */
  var pickables = [];
  var itemById = {};

  /* 画作详情页浏览顺序：按注册顺序收集「去重」的题材，供上一张/下一张导航 */
  var artOrder = [];

  /* 画作详情页文案（立着的画板 + 墙上画作共用）。ar = 画心宽高比，用于详情页按需重绘 */
  var ART_INFO = {
    starry:    { title: '星月夜',       series: '夜之诗',   ar: 1.5,  desc: '把整片夜空揉成漩涡，连月亮都舍不得闭上眼。风一吹，星星就轻轻晃。' },
    sunflower: { title: '向日葵',       series: '清晨的桌布', ar: 1.35, desc: '十二朵向日葵挤在一起，像谁把整个夏天一把抱住，连影子都暖了起来。' },
    blossom:   { title: '杏花',         series: '初春的信',  ar: 1.34, desc: '枝头刚绽的杏花，是写给今年春天的第一封短信，地址写在了风里。' },
    windmill:  { title: '风车',         series: '远处的风',  ar: 1.32, desc: '风车慢慢转，把一朵云推到天边，又把另一朵轻轻接住。' },
    hillside:  { title: '山脚下的村庄', series: '回家的路',  ar: 1.35, desc: '山脚亮起一盏灯，风刚好停在屋顶。远处的人，应该快到家了。' },
    landscape: { title: '麦田与柏树',   series: '夏天的边界', ar: 1.38, desc: '柏树站成一道墨绿，安静地守着一整片金黄，直到黄昏落下来。' },
    portrait:  { title: '自画像',       series: '镜子里的我', ar: 1.31, desc: '对着镜子画自己，画着画着就笑了——原来认真的样子，也很好看。' },
    bedroom:   { title: '阿尔勒的卧室', series: '安睡的角落', ar: 1.29, desc: '床单是暖的，墙也是暖的。闭上眼，整个房间都在替你守着夜。' },
    wheat:     { title: '麦田群鸦',     series: '黄昏的翅膀', ar: 1.32, desc: '乌鸦掠过麦浪，把黄昏惊起一层金。它们不说话，却飞得很认真。' },
    cafe:      { title: '夜间咖啡馆',   series: '亮着的窗',  ar: 1.35, desc: '街角那盏灯一直亮着，为每一个夜归的人，留一截可以歇脚的光。' }
  };

  /* =======================================================================
     1. 几何工具
     ======================================================================= */
  function roundedRect(w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    var s = new T.Shape();
    var x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    s.closePath();
    return s;
  }

  /** 带倒角的圆角立方体（沿 z 挤出，居中） */
  function softBox(w, h, d, bevel, corner, mat) {
    bevel = bevel === undefined ? 0.06 : bevel;
    bevel = Math.min(bevel, w / 2 - 0.006, h / 2 - 0.006, d / 2 - 0.006);
    bevel = Math.max(bevel, 0.004);
    var sw = Math.max(0.008, w - 2 * bevel);
    var sh = Math.max(0.008, h - 2 * bevel);
    var sd = Math.max(0.008, d - 2 * bevel);
    corner = corner === undefined ? 0.1 : corner;
    var r = Math.max(0.004, Math.min(corner, sw / 2 - 0.002, sh / 2 - 0.002));

    var geo = new T.ExtrudeGeometry(roundedRect(sw, sh, r), {
      depth: sd, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
      bevelSegments: 2, curveSegments: 4, steps: 1
    });
    geo.translate(0, 0, -sd / 2);
    var m = new T.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  /** 拱形（下矩形 + 上半圆） */
  function archShape(w, rectH) {
    var s = new T.Shape();
    var r = w / 2;
    s.moveTo(-r, 0);
    s.lineTo(r, 0);
    s.lineTo(r, rectH);
    s.absarc(0, rectH, r, 0, Math.PI, false);
    s.lineTo(-r, 0);
    s.closePath();
    return s;
  }

  function fitUV(geo) {
    geo.computeBoundingBox();
    var bb = geo.boundingBox;
    var sx = (bb.max.x - bb.min.x) || 1;
    var sy = (bb.max.y - bb.min.y) || 1;
    var p = geo.attributes.position;
    var uv = geo.attributes.uv;
    for (var i = 0; i < p.count; i++) {
      uv.setXY(i, (p.getX(i) - bb.min.x) / sx, (p.getY(i) - bb.min.y) / sy);
    }
    uv.needsUpdate = true;
    return geo;
  }

  function noRaycast(o) { o.raycast = function () {}; }
  function shadowAll(g) {
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  /* =======================================================================
     2. 程序化贴图
     ======================================================================= */
  function canvasTex(w, h, draw, opt) {
    opt = opt || {};
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new T.CanvasTexture(c);
    if (opt.srgb !== false) t.encoding = T.sRGBEncoding;
    t.wrapS = t.wrapT = opt.clamp ? T.ClampToEdgeWrapping : T.RepeatWrapping;
    if (opt.repeat) t.repeat.set(opt.repeat[0], opt.repeat[1]);
    t.anisotropy = 4;
    return t;
  }

  /* 木地板：暖深色横向长条 */
  function makeFloorTex() {
    return canvasTex(1024, 1024, function (ctx, w, h) {
      ctx.fillStyle = '#7a4220';
      ctx.fillRect(0, 0, w, h);
      var rows = 13, rh = h / rows;
      for (var i = 0; i < rows; i++) {
        var l = 132 + rand(-14, 14);
        ctx.fillStyle = 'rgb(' + Math.round(l) + ',' + Math.round(l * 0.63) + ',' + Math.round(l * 0.38) + ')';
        ctx.fillRect(0, i * rh, w, rh);
        for (var g = 0; g < 22; g++) {
          ctx.strokeStyle = 'rgba(96,56,28,' + rand(0.02, 0.07).toFixed(3) + ')';
          ctx.lineWidth = rand(0.6, 2.2);
          ctx.beginPath();
          var y0 = i * rh + rand(0, rh);
          ctx.moveTo(0, y0);
          for (var x = 0; x <= w; x += 46) {
            ctx.lineTo(x, y0 + Math.sin(x * 0.012 + g * 1.7) * rand(1.4, 4.6));
          }
          ctx.stroke();
        }
        var seam = ((i % 2) ? 0.33 : 0.72) * w;
        ctx.fillStyle = 'rgba(64,36,16,0.36)';
        ctx.fillRect(seam, i * rh, 3, rh);
        ctx.fillStyle = 'rgba(60,32,14,0.42)';
        ctx.fillRect(0, i * rh + rh - 3, w, 3);
        ctx.fillStyle = 'rgba(255,224,180,0.06)';
        ctx.fillRect(0, i * rh, w, 2);
      }
    });
  }

  /* 木板墙：暖橙色横板 + 木纹 + 结疤 */
  function makePlankTex() {
    return canvasTex(1024, 1024, function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#a15d27');
      g.addColorStop(0.5, '#8c4d1f');
      g.addColorStop(1, '#763f1a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      var rows = 9, rh = h / rows;
      for (var i = 0; i < rows; i++) {
        var off = (i % 2) * rand(-30, 30);
        ctx.fillStyle = 'rgba(255,205,150,' + rand(0.02, 0.06).toFixed(3) + ')';
        ctx.fillRect(0, i * rh + 2, w, rh - 4);
        // 木纹丝
        for (var s = 0; s < 8; s++) {
          ctx.strokeStyle = 'rgba(104,58,26,' + rand(0.05, 0.13).toFixed(3) + ')';
          ctx.lineWidth = rand(0.8, 2);
          ctx.beginPath();
          var yy = i * rh + rand(8, rh - 8);
          ctx.moveTo(0, yy);
          for (var x = 0; x <= w; x += 40) {
            ctx.lineTo(x, yy + Math.sin((x + off) * 0.012 + s) * rand(1, 4));
          }
          ctx.stroke();
        }
        // 板缝
        ctx.fillStyle = 'rgba(56,30,12,0.5)';
        ctx.fillRect(0, i * rh, w, 3);
        ctx.fillStyle = 'rgba(255,214,170,0.09)';
        ctx.fillRect(0, i * rh + 3, w, 2);
        // 结疤
        if (Math.random() > 0.6) {
          var kx = rand(0, w), ky = i * rh + rh * 0.5;
          ctx.strokeStyle = 'rgba(80,42,18,0.4)';
          for (var k = 0; k < 3; k++) {
            ctx.beginPath();
            ctx.ellipse(kx, ky, 6 + k * 5, 3 + k * 3, 0, 0, 6.283);
            ctx.stroke();
          }
        }
      }
    }, { repeat: [1, 1] });
  }

  /* 石墙：暖色石块 + 灰缝 */
  function makeStoneTex() {
    return canvasTex(1024, 1024, function (ctx, w, h) {
      ctx.fillStyle = '#b89b78';
      ctx.fillRect(0, 0, w, h);
      var rows = 8, rh = h / rows;
      for (var r = 0; r < rows; r++) {
        var n = 5 + (r % 2), bw = w / n, ox = (r % 2) * bw * 0.5;
        for (var c = -1; c <= n; c++) {
          var x = c * bw + ox, y = r * rh;
          var base = 176 + rand(-22, 22);
          ctx.fillStyle = 'rgb(' + Math.round(base) + ',' + Math.round(base * 0.87) + ',' + Math.round(base * 0.7) + ')';
          roundRectPath(ctx, x + 4, y + 4, bw - 8, rh - 8, 10);
          ctx.fill();
          // 石纹
          for (var s = 0; s < 26; s++) {
            ctx.fillStyle = Math.random() > 0.5
              ? 'rgba(255,244,225,' + rand(0.02, 0.06).toFixed(3) + ')'
              : 'rgba(120,92,62,' + rand(0.02, 0.07).toFixed(3) + ')';
            ctx.fillRect(x + rand(6, bw - 6), y + rand(6, rh - 6), rand(2, 9), rand(2, 7));
          }
        }
      }
      // 整体压暗边缘
      var vg = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.72);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(60,40,22,0.16)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
    }, { repeat: [1.4, 1.2] });
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* 地毯：暖色圆毯 */
  var texRug = canvasTex(512, 512, function (ctx, w, h) {
    var c = w / 2;
    var g = ctx.createRadialGradient(c, c, 6, c, c, c);
    g.addColorStop(0, '#df9a55');
    g.addColorStop(0.5, '#cb7d38');
    g.addColorStop(0.82, '#b0652b');
    g.addColorStop(0.88, '#d38a45');
    g.addColorStop(1, '#9c5622');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < 700; i++) {
      ctx.strokeStyle = 'rgba(255,240,220,' + rand(0.02, 0.08).toFixed(3) + ')';
      ctx.lineWidth = 1;
      var a = rand(0, 6.283), r = rand(0.18, 1) * c;
      ctx.beginPath();
      ctx.arc(c, c, r, a, a + 0.06);
      ctx.stroke();
    }
    // 同心环
    ctx.strokeStyle = 'rgba(120,74,36,0.22)';
    ctx.lineWidth = 3;
    [0.62, 0.74, 0.86].forEach(function (rr) {
      ctx.beginPath(); ctx.arc(c, c, c * rr, 0, 6.283); ctx.stroke();
    });
  }, { clamp: true });

  /* 窗外黄昏 */
  var texWindow = canvasTex(512, 640, function (ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2a2340');
    g.addColorStop(0.32, '#6f4a5c');
    g.addColorStop(0.56, '#d98c62');
    g.addColorStop(0.78, '#f6c58c');
    g.addColorStop(1, '#fbe4bb');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    var rg = ctx.createRadialGradient(w * 0.52, h * 0.68, 6, w * 0.52, h * 0.68, w * 0.6);
    rg.addColorStop(0, 'rgba(255,244,220,0.85)');
    rg.addColorStop(0.35, 'rgba(255,214,160,0.5)');
    rg.addColorStop(1, 'rgba(255,190,130,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
    // 远山
    ctx.fillStyle = 'rgba(120,74,74,0.4)';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.86);
    ctx.bezierCurveTo(w * 0.25, h * 0.77, w * 0.42, h * 0.9, w * 0.62, h * 0.83);
    ctx.bezierCurveTo(w * 0.8, h * 0.77, w * 0.9, h * 0.86, w, h * 0.82);
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fill();
    // 星点
    for (var i = 0; i < 40; i++) {
      ctx.fillStyle = 'rgba(255,248,225,' + rand(0.3, 0.9).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(rand(0, w), rand(0, h * 0.55), rand(0.6, 2), 0, 6.283);
      ctx.fill();
    }
  }, { clamp: true });

  /* 接触阴影 */
  var texAO = canvasTex(256, 256, function (ctx, w, h) {
    var g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(56,30,14,0.55)');
    g.addColorStop(0.4, 'rgba(56,30,14,0.24)');
    g.addColorStop(0.72, 'rgba(56,30,14,0.07)');
    g.addColorStop(1, 'rgba(50,24,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { clamp: true });

  /* 柔光 */
  var texGlow = canvasTex(128, 128, function (ctx, w, h) {
    var g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.22, 'rgba(255,240,215,0.72)');
    g.addColorStop(0.5, 'rgba(255,214,165,0.2)');
    g.addColorStop(1, 'rgba(255,200,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { clamp: true });

  /* 星光 */
  var texStar = canvasTex(128, 128, function (ctx, w, h) {
    var c = w / 2;
    var g = ctx.createRadialGradient(c, c, 0, c, c, c * 0.45);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,235,205,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,250,240,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c, 8); ctx.lineTo(c, h - 8);
    ctx.moveTo(8, c); ctx.lineTo(w - 8, c);
    ctx.stroke();
  }, { clamp: true });

  /* =======================================================================
     2b. 梵高风挂画贴图
     ======================================================================= */
  var artCache = {};
  function artTex(kind) {
    if (artCache[kind]) return artCache[kind];
    var t = canvasTex(400, 300, function (ctx, w, h) { drawArt(ctx, w, h, kind); }, { clamp: true });
    artCache[kind] = t;
    return t;
  }

  function drawArt(ctx, w, h, kind) {
    function bgv(c1, c2) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    function bgh(c1, c2) {
      var g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    function strokes(n, colFn, lMin, lMax, tMin, tMax) {
      ctx.lineCap = 'round';
      for (var i = 0; i < n; i++) {
        ctx.strokeStyle = colFn();
        ctx.lineWidth = rand(tMin, tMax);
        var x = rand(0, w), y = rand(0, h);
        var a = rand(0, 6.283), l = rand(lMin, lMax);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        ctx.stroke();
      }
    }
    function hill(y, col, amp) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, y);
      for (var x = 0; x <= w; x += 24) {
        ctx.lineTo(x, y + Math.sin(x * 0.02) * amp);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }

    switch (kind) {
      case 'starry':
        bgv('#16223f', '#3a4d78');
        // 漩涡星云
        for (var s = 0; s < 5; s++) {
          var cx = rand(w * 0.15, w * 0.85), cy = rand(h * 0.15, h * 0.55);
          var rr0 = rand(20, 50);
          for (var a = 0; a < 70; a++) {
            var t2 = a / 70, ang = t2 * 6.283 * 3.2, rr = t2 * rr0;
            ctx.strokeStyle = 'rgba(' + randInt(190, 225) + ',' + randInt(205, 232) + ',' + randInt(235, 255) + ',' + rand(0.25, 0.7).toFixed(2) + ')';
            ctx.lineWidth = rand(1.2, 3.2);
            ctx.beginPath(); ctx.arc(cx, cy, rr, ang, ang + 0.7); ctx.stroke();
          }
        }
        // 星（带光晕）
        for (var i = 0; i < 46; i++) {
          var sx2 = rand(0, w), sy2 = rand(0, h * 0.6), sr = rand(1, 3.4);
          ctx.strokeStyle = 'rgba(255,240,180,0.45)'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(sx2, sy2, sr + rand(2, 4), 0, 6.283); ctx.stroke();
          ctx.fillStyle = 'rgba(255,248,214,' + rand(0.7, 1).toFixed(2) + ')';
          ctx.beginPath(); ctx.arc(sx2, sy2, sr, 0, 6.283); ctx.fill();
        }
        // 月亮
        ctx.fillStyle = 'rgba(255,238,150,0.35)';
        ctx.beginPath(); ctx.arc(w * 0.74, h * 0.2, 40, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#f9e07e';
        ctx.beginPath(); ctx.arc(w * 0.74, h * 0.2, 27, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#fff3c4';
        ctx.beginPath(); ctx.arc(w * 0.72, h * 0.185, 12, 0, 6.283); ctx.fill();
        // 远山 + 村庄（亮窗）
        hill(h * 0.8, '#232d4a', 6);
        for (var v = 0; v < 9; v++) {
          var vx = rand(w * 0.12, w * 0.92), vw = rand(6, 13), vhh = rand(9, 20);
          ctx.fillStyle = '#1a2338';
          ctx.fillRect(vx, h * 0.74 + rand(-5, 8), vw, vhh);
          ctx.fillStyle = 'rgba(255,206,120,0.9)'; ctx.fillRect(vx + 2, h * 0.76, 2.5, 2.5);
        }
        // 丝柏（深色，带纹理）
        ctx.fillStyle = '#0f1f2c';
        ctx.beginPath();
        ctx.moveTo(w * 0.24, h); ctx.quadraticCurveTo(w * 0.15, h * 0.55, w * 0.24, h * 0.22);
        ctx.quadraticCurveTo(w * 0.33, h * 0.55, w * 0.31, h); ctx.closePath(); ctx.fill();
        for (var cyp = 0; cyp < 60; cyp++) {
          ctx.strokeStyle = 'rgba(40,70,60,0.5)'; ctx.lineWidth = 1;
          var cxy = rand(h * 0.25, h);
          ctx.beginPath(); ctx.moveTo(w * 0.24 + rand(-6, 6), cxy); ctx.lineTo(w * 0.24 + rand(-4, 8), cxy + 10); ctx.stroke();
        }
        break;

      case 'wheat':
        bgv('#9fc0d8', '#d8c88a');
        ctx.fillStyle = '#f2d06a';
        ctx.beginPath(); ctx.arc(w * 0.7, h * 0.28, 34, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#3a4a2a';
        ctx.beginPath();
        ctx.moveTo(w * 0.2, h); ctx.quadraticCurveTo(w * 0.13, h * 0.42, w * 0.2, h * 0.18);
        ctx.quadraticCurveTo(w * 0.29, h * 0.42, w * 0.27, h); ctx.fill();
        strokes(300, function () {
          return 'rgba(' + randInt(210, 255) + ',' + randInt(150, 200) + ',' + randInt(50, 110) + ',0.72)';
        }, 8, 22, 2, 4);
        break;

      case 'bedroom':
        bgv('#cfd6c2', '#e6d9a8');
        // 墙
        ctx.fillStyle = '#d9cfa0'; ctx.fillRect(0, 0, w, h * 0.62);
        ctx.fillStyle = '#c9b98a'; ctx.fillRect(0, h * 0.62, w, h * 0.38);
        // 窗
        ctx.fillStyle = '#8fb0c0'; ctx.fillRect(w * 0.12, h * 0.18, w * 0.2, h * 0.3);
        ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 4;
        ctx.strokeRect(w * 0.12, h * 0.18, w * 0.2, h * 0.3);
        // 床
        ctx.fillStyle = '#c98a3a'; ctx.fillRect(w * 0.4, h * 0.48, w * 0.5, h * 0.34);
        ctx.fillStyle = '#e2b56a'; ctx.fillRect(w * 0.42, h * 0.52, w * 0.46, h * 0.14);
        ctx.fillStyle = '#a86a2a'; ctx.fillRect(w * 0.4, h * 0.78, w * 0.5, h * 0.08);
        // 椅
        ctx.fillStyle = '#8a5a2a'; ctx.fillRect(w * 0.3, h * 0.6, w * 0.09, h * 0.24);
        ctx.fillStyle = '#c58a3a'; ctx.fillRect(w * 0.28, h * 0.56, w * 0.13, h * 0.08);
        strokes(90, function () { return 'rgba(120,90,50,0.12)'; }, 4, 12, 1, 2);
        break;

      case 'portrait':
        bgh('#3f6a70', '#5a8a80');
        for (var p = 0; p < 60; p++) {
          ctx.strokeStyle = 'rgba(' + randInt(60, 110) + ',' + randInt(110, 150) + ',' + randInt(120, 160) + ',0.5)';
          ctx.lineWidth = rand(4, 9);
          var px = rand(0, w), py = rand(0, h), pa = rand(0, 6.28);
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(pa) * 16, py + Math.sin(pa) * 16); ctx.stroke();
        }
        // 脸
        ctx.fillStyle = '#e0b088';
        ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.52, w * 0.2, h * 0.26, 0, 0, 6.283); ctx.fill();
        // 帽子
        ctx.fillStyle = '#c7a24e';
        ctx.beginPath(); ctx.moveTo(w * 0.28, h * 0.32); ctx.lineTo(w * 0.72, h * 0.32); ctx.lineTo(w * 0.66, h * 0.16); ctx.lineTo(w * 0.34, h * 0.16); ctx.closePath(); ctx.fill();
        // 胡子
        ctx.fillStyle = '#b06a3a';
        ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.72, w * 0.13, h * 0.09, 0, 0, 6.283); ctx.fill();
        // 眼
        ctx.fillStyle = '#33241a';
        ctx.beginPath(); ctx.arc(w * 0.44, h * 0.5, 3.4, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.arc(w * 0.56, h * 0.5, 3.4, 0, 6.283); ctx.fill();
        break;

      case 'blossom':
        bgv('#4f8079', '#7fa699');
        strokes(140, function () { return 'rgba(120,150,140,0.16)'; }, 6, 16, 2, 4);
        // 枝
        ctx.strokeStyle = '#4a3220'; ctx.lineWidth = 7; ctx.lineCap = 'round';
        function branch(x0, y0, x1, y1) {
          ctx.beginPath(); ctx.moveTo(x0, y0);
          ctx.quadraticCurveTo((x0 + x1) / 2 + rand(-20, 20), (y0 + y1) / 2, x1, y1);
          ctx.stroke();
        }
        branch(w * 0.2, h, w * 0.5, h * 0.42);
        branch(w * 0.5, h * 0.42, w * 0.82, h * 0.25);
        branch(w * 0.5, h * 0.42, w * 0.6, h * 0.1);
        branch(w * 0.5, h * 0.42, w * 0.3, h * 0.22);
        // 细枝
        ctx.strokeStyle = '#5a3e28'; ctx.lineWidth = 3;
        for (var tw = 0; tw < 10; tw++) {
          var bx = rand(w * 0.2, w * 0.85), by = rand(h * 0.12, h * 0.55);
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + rand(-30, 30), by + rand(-24, 24)); ctx.stroke();
        }
        // 花（白 + 淡粉）
        for (var fl = 0; fl < 54; fl++) {
          var fx = rand(w * 0.1, w * 0.94), fy = rand(h * 0.04, h * 0.62);
          var pinkish = fl % 4 === 0;
          ctx.fillStyle = pinkish ? 'rgba(252,214,222,0.95)' : 'rgba(255,250,244,' + rand(0.8, 1).toFixed(2) + ')';
          var pr = rand(3.5, 6);
          for (var pt = 0; pt < 5; pt++) {
            var fa = pt / 5 * 6.283;
            ctx.beginPath(); ctx.ellipse(fx + Math.cos(fa) * pr * 0.9, fy + Math.sin(fa) * pr * 0.9, pr * 0.75, pr * 0.5, fa, 0, 6.283); ctx.fill();
          }
          ctx.fillStyle = '#d9a63e';
          ctx.beginPath(); ctx.arc(fx, fy, 2, 0, 6.283); ctx.fill();
        }
        break;

      case 'sunflower':
        bgv('#f6d84e', '#e6ab30');
        strokes(160, function () { return 'rgba(230,180,60,0.16)'; }, 8, 22, 2, 5);
        // 花瓶
        ctx.fillStyle = '#c47c33';
        ctx.beginPath();
        ctx.moveTo(w * 0.4, h * 0.6); ctx.quadraticCurveTo(w * 0.34, h * 0.78, w * 0.42, h * 0.94);
        ctx.lineTo(w * 0.58, h * 0.94); ctx.quadraticCurveTo(w * 0.66, h * 0.78, w * 0.6, h * 0.6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#a9652a'; ctx.fillRect(w * 0.4, h * 0.6, w * 0.2, h * 0.05);
        // 花（高低错落）
        var blooms = [
          [0.34, 0.41, 15], [0.5, 0.30, 17], [0.66, 0.4, 14], [0.44, 0.24, 12],
          [0.58, 0.22, 13], [0.3, 0.55, 11], [0.7, 0.56, 11]
        ];
        blooms.forEach(function (B) {
          var sx = w * B[0], sy = h * B[1], rad = B[2];
          ctx.strokeStyle = '#5f6f2e'; ctx.lineWidth = 3; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + 8, h * 0.48, w * 0.5, h * 0.62); ctx.stroke();
          for (var layer = 0; layer < 2; layer++) {
            ctx.fillStyle = layer ? '#f0a02c' : '#d97e1e';
            var r_r = rad * (layer ? 1 : 0.82), off = layer ? 0 : 0.26;
            for (var pe = 0; pe < 14; pe++) {
              var pea = pe / 14 * 6.283 + off;
              ctx.beginPath();
              ctx.ellipse(sx + Math.cos(pea) * r_r, sy + Math.sin(pea) * r_r, r_r * 0.46, r_r * 0.24, pea, 0, 6.283);
              ctx.fill();
            }
          }
          ctx.fillStyle = '#6a3f1c';
          ctx.beginPath(); ctx.arc(sx, sy, rad * 0.6, 0, 6.283); ctx.fill();
          ctx.fillStyle = '#8a5a26';
          for (var sd = 0; sd < 18; sd++) {
            var sa = sd / 18 * 6.283;
            ctx.beginPath(); ctx.arc(sx + Math.cos(sa) * rad * 0.42, sy + Math.sin(sa) * rad * 0.42, 1.1, 0, 6.283); ctx.fill();
          }
        });
        break;

      case 'windmill':
        bgv('#a8c4d8', '#e0d2a0');
        hill(h * 0.66, '#7a8a4a', 10);
        hill(h * 0.8, '#5f7438', 8);
        // 风车
        ctx.fillStyle = '#b06a3a';
        ctx.beginPath(); ctx.moveTo(w * 0.62, h * 0.68); ctx.lineTo(w * 0.66, h * 0.36); ctx.lineTo(w * 0.7, h * 0.68); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8a4a26';
        for (var bl = 0; bl < 4; bl++) {
          var ba = bl / 4 * 6.283 + 0.4;
          ctx.save();
          ctx.translate(w * 0.66, h * 0.34);
          ctx.rotate(ba);
          ctx.fillRect(-2, 0, 4, h * 0.16);
          ctx.restore();
        }
        strokes(80, function () { return 'rgba(90,120,60,0.16)'; }, 6, 16, 2, 3);
        break;

      case 'landscape':
        bgv('#9fc0d8', '#e6d8a8');
        hill(h * 0.6, '#7a8f52', 12);
        hill(h * 0.78, '#5c7038', 9);
        ctx.fillStyle = '#4a5a2a';
        ctx.beginPath(); ctx.arc(w * 0.24, h * 0.66, 16, 0, 6.283); ctx.fill();
        ctx.fillRect(w * 0.23, h * 0.66, 6, h * 0.2);
        ctx.fillStyle = '#f2e08a';
        ctx.beginPath(); ctx.arc(w * 0.76, h * 0.24, 22, 0, 6.283); ctx.fill();
        strokes(70, function () { return 'rgba(80,110,55,0.14)'; }, 6, 16, 2, 3);
        break;

      case 'hillside':
        bgv('#cdd8b0', '#9ab070');
        hill(h * 0.55, '#7f9a4e', 14);
        hill(h * 0.72, '#62803a', 10);
        ctx.fillStyle = '#4e6428';
        ctx.beginPath(); ctx.arc(w * 0.7, h * 0.5, 20, 0, 6.283); ctx.fill();
        ctx.fillRect(w * 0.69, h * 0.5, 8, h * 0.26);
        strokes(110, function () { return 'rgba(70,95,40,0.16)'; }, 6, 16, 2, 4);
        break;

      case 'cafe':
        bgv('#2e3a5a', '#6a5a6a');
        // 星空
        for (var st = 0; st < 30; st++) {
          ctx.fillStyle = 'rgba(255,240,200,' + rand(0.3, 0.9).toFixed(2) + ')';
          ctx.beginPath(); ctx.arc(rand(0, w), rand(0, h * 0.4), rand(0.8, 2.4), 0, 6.283); ctx.fill();
        }
        // 雨棚
        ctx.fillStyle = '#e0b03a'; ctx.fillRect(0, h * 0.4, w, h * 0.14);
        // 墙面
        ctx.fillStyle = '#c98a3a'; ctx.fillRect(0, h * 0.54, w, h * 0.46);
        // 窗
        ctx.fillStyle = '#f2d06a'; ctx.fillRect(w * 0.1, h * 0.58, w * 0.2, h * 0.2);
        // 桌椅
        ctx.fillStyle = '#5a3a22';
        for (var tb = 0; tb < 3; tb++) {
          var tx = w * 0.3 + tb * w * 0.22;
          ctx.fillRect(tx, h * 0.72, w * 0.1, h * 0.05);
          ctx.fillRect(tx + w * 0.04, h * 0.77, 3, h * 0.1);
        }
        break;
    }

    // 统一色罩：让所有挂画带一点暖橙调
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(240,170,90,0.045)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  /* =======================================================================
     3. 渲染器 / 场景 / 相机
     ======================================================================= */
  var canvas = document.getElementById('scene');
  var pane = document.getElementById('pane-scene');

  // 关键：关闭 legacy 色彩模式，让 0xRRGGBB 按 sRGB 解释并转线性，
  // 否则所有颜色会被当作线性值直接相加，整体发白、失去饱和度。
  if (T.ColorManagement) T.ColorManagement.legacyMode = false;

  var renderer = new T.WebGLRenderer({
    canvas: canvas, antialias: true, alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(30, 1, 0.5, 320);

  /* 环境贴图：暖光阁楼 */
  var envTex = canvasTex(1024, 512, function (ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#120c08');
    g.addColorStop(0.4, '#2a1a10');
    g.addColorStop(0.62, '#5a3418');
    g.addColorStop(1, '#0e0904');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    var g1 = ctx.createRadialGradient(w * 0.66, h * 0.58, 8, w * 0.66, h * 0.58, 250);
    g1.addColorStop(0, 'rgba(255,206,140,1)');
    g1.addColorStop(0.42, 'rgba(255,168,104,0.42)');
    g1.addColorStop(1, 'rgba(255,150,90,0)');
    ctx.fillStyle = g1;
    ctx.beginPath(); ctx.arc(w * 0.66, h * 0.58, 250, 0, 6.283); ctx.fill();

    var g2 = ctx.createRadialGradient(w * 0.2, h * 0.4, 8, w * 0.2, h * 0.4, 170);
    g2.addColorStop(0, 'rgba(255,190,120,0.5)');
    g2.addColorStop(1, 'rgba(255,170,100,0)');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(w * 0.2, h * 0.4, 170, 0, 6.283); ctx.fill();
  }, { clamp: true });

  envTex.mapping = T.EquirectangularReflectionMapping;
  var pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(envTex).texture;
  pmrem.dispose();

  /* =======================================================================
     4. 材质（暖橙色阁楼）
     ======================================================================= */
  function std(color, o) {
    o = o || {};
    return new T.MeshStandardMaterial(Object.assign({
      color: color, roughness: 0.92, metalness: 0.0, envMapIntensity: 0.24
    }, o));
  }

  var M = {
    plank: std(0xffffff, { map: makePlankTex(), roughness: 0.88, envMapIntensity: 0.16 }),
    stone: std(0xffffff, { map: makeStoneTex(), roughness: 0.94, envMapIntensity: 0.14 }),
    floor: std(0xffffff, { map: makeFloorTex(), roughness: 0.7, envMapIntensity: 0.2 }),
    floorEdge: std(0x6e3f22, { roughness: 0.85 }),
    base: std(0x7a4526, { roughness: 0.9 }),

    frame: std(0xa8661f, { roughness: 0.58, envMapIntensity: 0.32 }),    // 暖琥珀木框
    frameLight: std(0xc98a45, { roughness: 0.62, envMapIntensity: 0.26 }), // 浅木框
    frameDeep: std(0x7d4514, { roughness: 0.64 }),                      // 深琥珀木框
    frameDark: std(0x6f3d15, { roughness: 0.8 }),                       // 深色内衬/阴影缝
    wood: std(0x9d5f30, { roughness: 0.72 }),
    woodLight: std(0xb57a45, { roughness: 0.75 }),
    woodDark: std(0x6f4424, { roughness: 0.72 }),

    cream: std(0xf0dcb8, { roughness: 0.86 }),
    creamTrim: std(0xe7c99a, { roughness: 0.82 }),

    cushion: std(0xcc6a20, { roughness: 0.86 }),
    cushionDeep: std(0x8f4413, { roughness: 0.9 }),
    cushionSoft: std(0xdd8636, { roughness: 0.88 }),
    cushionPale: std(0xefc07f, { roughness: 0.9 }),

    terracotta: std(0xab5a33, { roughness: 0.9 }),
    leaf: std(0x5c8030, { roughness: 0.9 }),
    leafDark: std(0x456028, { roughness: 0.9 }),
    leafLight: std(0x769a3e, { roughness: 0.9 }),
    petal: std(0xf5b42a, { roughness: 0.85 }),
    petalDeep: std(0xd8861c, { roughness: 0.85 }),
    seed: std(0x6e4320, { roughness: 0.9 }),

    stoneMat: std(0xc7ac8b, { roughness: 0.9 }),
    stoneLight: std(0xd8c3a2, { roughness: 0.88 }),

    dark: std(0x2f2620, { roughness: 0.75 }),
    gold: std(0xe3ae5e, { roughness: 0.3, metalness: 0.95, envMapIntensity: 1.5 }),
    goldSoft: std(0xd9a45c, { roughness: 0.45, metalness: 0.7, envMapIntensity: 1.1 }),
    white: std(0xfbf3e6, { roughness: 0.92 }),

    bookGreen: std(0x8a9a5a, { roughness: 0.85 }),
    bookRed: std(0xb06a4a, { roughness: 0.85 }),
    bookBlue: std(0x6a7a8a, { roughness: 0.85 }),

    rug: std(0xf6e6cc, { map: texRug, roughness: 0.98, envMapIntensity: 0.26 })
  };

  /* =======================================================================
     5. 灯光（暖）
     ======================================================================= */
  scene.add(new T.HemisphereLight(0xffc79a, 0x20140a, 0.46));

  var key = new T.DirectionalLight(0xffe0b8, 0.62);
  key.position.set(6.5, 14, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 13;
  key.shadow.camera.bottom = -9;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 50;
  key.shadow.bias = -0.0009;
  key.shadow.normalBias = 0.03;
  scene.add(key);
  scene.add(key.target);

  var fill = new T.PointLight(0xffab6e, 0.55, 20, 2);
  fill.position.set(0.9, 3.2, 1.6);
  scene.add(fill);

  var windowLight = new T.PointLight(0xffc98a, 0.85, 15, 2);
  windowLight.position.set(2.0, 3.9, -4.3);
  scene.add(windowLight);

  var galleryLight = new T.PointLight(0xffa858, 0.6, 16, 2);
  galleryLight.position.set(-4.5, 3.7, 0.6);
  scene.add(galleryLight);

  var loftLight = new T.PointLight(0xffbd84, 0.8, 13, 2);
  loftLight.position.set(-1.1, 2.1, -3.1);
  scene.add(loftLight);

  var nookLight = new T.PointLight(0xffb87c, 0.55, 9, 2);
  nookLight.position.set(-2.72, 1.5, -4.1);
  scene.add(nookLight);

  var coveLight = new T.PointLight(0xffb070, 0.45, 12, 2);
  coveLight.position.set(4.4, 3.0, -3.0);
  scene.add(coveLight);

  var rim = new T.DirectionalLight(0xffa860, 0.28);
  rim.position.set(-9, 6, -7);
  scene.add(rim);

  /* =======================================================================
     6. 房间外壳（木板墙 + 石墙 + 阁楼顶棚）
     ======================================================================= */
  var room = new T.Group();
  scene.add(room);

  // 石拱龛：x 从 ALCOVE.x0 到右墙，z 从 ALCOVE.z 到后墙
  var ALCOVE = { x0: 1.35, z: -1.95, top: 4.34 };

  function wallShape(len, hgt, r) {
    var L = len / 2, s = new T.Shape();
    s.moveTo(-L, 0);
    s.lineTo(L, 0);
    s.lineTo(L, hgt - r);
    s.quadraticCurveTo(L, hgt, L - r, hgt);
    s.lineTo(-L + r, hgt);
    s.quadraticCurveTo(-L, hgt, -L, hgt - r);
    s.closePath();
    return s;
  }

  (function buildShell() {
    // 地板
    var floor = new T.Mesh(new T.BoxGeometry(ROOM.w, 0.3, ROOM.d), M.floor);
    floor.position.y = -0.15;
    floor.receiveShadow = true;
    room.add(floor);

    var edge = new T.Mesh(new T.BoxGeometry(ROOM.w + 0.04, 0.1, ROOM.d + 0.04), M.floorEdge);
    edge.position.y = -0.32;
    room.add(edge);

    var frontEdge = new T.Mesh(new T.BoxGeometry(ROOM.w + 0.3, 0.34, 0.22), M.base);
    frontEdge.position.set(0, -0.2, HD + 0.08);
    room.add(frontEdge);

    function wallMesh(len, mat, hgt) {
      var m = new T.Mesh(new T.ExtrudeGeometry(wallShape(len, hgt || ROOM.h, 0.7), {
        depth: ROOM.t, bevelEnabled: true, bevelThickness: 0.045, bevelSize: 0.045,
        bevelSegments: 2, curveSegments: 18, steps: 1
      }), mat);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    }

    // 左墙：整面木板（挂画墙）
    var left = wallMesh(ROOM.d + 2 * ROOM.t, M.plank);
    left.rotation.y = Math.PI / 2;
    left.position.set(-HW - ROOM.t, 0, 0);
    room.add(left);

    // 后墙左段：木板
    var bwL = ALCOVE.x0 + HW + 0.1;
    var backL = wallMesh(bwL, M.plank);
    backL.position.set(-HW + bwL / 2, 0, -HD - ROOM.t);
    room.add(backL);

    // 后墙右段：石材
    var bwR = HW - ALCOVE.x0 + 0.1;
    var backR = wallMesh(bwR, M.stone);
    backR.position.set(ALCOVE.x0 + bwR / 2, 0, -HD - ROOM.t);
    room.add(backR);

    // 右后角石壁（只到龛高，不做满墙，避免遮挡镜头）
    var rwLen = 3.4;
    var right = wallMesh(rwLen, M.stone, ALCOVE.top);
    right.rotation.y = -Math.PI / 2;
    right.position.set(HW + ROOM.t, 0, -HD + rwLen / 2);
    room.add(right);

    // 左墙竖向压条（板条感）
    for (var vb = 1; vb <= 4; vb++) {
      var bat = new T.Mesh(new T.BoxGeometry(0.075, ROOM.h - 1.0, 0.055), M.woodDark);
      bat.position.set(-HW + 0.045, (ROOM.h - 1.0) / 2 + 0.15, 4.7 - vb * 2.35);
      room.add(bat);
    }

    // 踢脚线
    var sk1 = new T.Mesh(new T.BoxGeometry(bwL, 0.16, 0.07), M.woodDark);
    sk1.position.set(-HW + bwL / 2, 0.08, -HD + 0.035);
    room.add(sk1);
    var sk2 = new T.Mesh(new T.BoxGeometry(0.07, 0.16, ROOM.d), M.woodDark);
    sk2.position.set(-HW + 0.035, 0.08, 0);
    room.add(sk2);

    // 顶部横梁
    var beamL = new T.Mesh(new T.BoxGeometry(0.22, 0.28, ROOM.d + 0.3), M.woodDark);
    beamL.position.set(-HW + 0.15, ROOM.h - 0.46, 0);
    beamL.castShadow = true;
    room.add(beamL);

    var beamB = new T.Mesh(new T.BoxGeometry(ROOM.w + 0.2, 0.26, 0.24), M.woodDark);
    beamB.position.set(0, ROOM.h - 0.58, -HD + 0.16);
    room.add(beamB);

    /* ---------------- 石拱龛：隔墙 + 拱洞 ---------------- */
    var plateW = HW - ALCOVE.x0 + 0.12;
    var plateH = ALCOVE.top;
    var ps = new T.Shape();
    ps.moveTo(-plateW / 2, 0);
    ps.lineTo(plateW / 2, 0);
    ps.lineTo(plateW / 2, plateH);
    ps.lineTo(-plateW / 2, plateH);
    ps.closePath();

    var ar = (plateW - 1.05) / 2;
    var ah = plateH - ar - 0.3;
    var hp = new T.Path();
    hp.moveTo(-ar, 0);
    hp.lineTo(ar, 0);
    hp.lineTo(ar, ah);
    hp.absarc(0, ah, ar, 0, Math.PI, false);
    hp.lineTo(-ar, 0);
    hp.closePath();
    ps.holes.push(hp);

    var plate = new T.Mesh(new T.ExtrudeGeometry(ps, {
      depth: 0.28, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035,
      bevelSegments: 2, curveSegments: 26, steps: 1
    }), M.stone);
    plate.position.set(ALCOVE.x0 + plateW / 2 - 0.06, 0, ALCOVE.z - 0.28);
    plate.castShadow = true;
    plate.receiveShadow = true;
    room.add(plate);

    // 拱洞内一圈石压边
    var rimArc = new T.Mesh(new T.TorusGeometry(ar, 0.09, 6, 44, Math.PI), M.stoneLight);
    rimArc.position.set(ALCOVE.x0 + plateW / 2 - 0.06, ah, ALCOVE.z + 0.02);
    room.add(rimArc);


    // 龛口石槛
    var sill = new T.Mesh(new T.BoxGeometry(plateW, 0.09, 0.15), M.stoneLight);
    sill.position.set(ALCOVE.x0 + plateW / 2 - 0.06, 0.045, ALCOVE.z + 0.03);
    room.add(sill);
  })();

  /* =======================================================================
     7. 楼梯 + 阁楼 + 白色格栅栏杆
     ======================================================================= */
  // 楼梯：贴左墙，沿 -z 方向往上（格栅栏杆朝房间一侧）
  var STAIR = { steps: 8, rise: 0.34, run: 0.42, width: 1.9, x0: -HW, z0: 1.41 };

  /** 格栅（X 交叉）栏杆，位于 XY 平面，长度沿 x、高度沿 y */
  function buildLattice(len, hgt) {
    var g = new T.Group();
    [0.07, hgt - 0.07].forEach(function (y) {
      var r = new T.Mesh(new T.BoxGeometry(len, 0.075, 0.05), M.creamTrim);
      r.position.y = y;
      g.add(r);
    });
    var n = Math.max(2, Math.round(len / 0.5));
    var seg = len / n;
    for (var i = 0; i <= n; i++) {
      var p = new T.Mesh(new T.BoxGeometry(0.06, hgt, 0.055), M.creamTrim);
      p.position.set(-len / 2 + i * seg, hgt / 2, 0);
      g.add(p);
    }
    for (var j = 0; j < n; j++) {
      var x0 = -len / 2 + j * seg;
      var dl = Math.hypot(seg, hgt - 0.12);
      var ang = Math.atan2(hgt - 0.12, seg);
      var d1 = new T.Mesh(new T.BoxGeometry(dl, 0.042, 0.042), M.cream);
      d1.position.set(x0 + seg / 2, hgt / 2, 0);
      d1.rotation.z = ang;
      g.add(d1);
      var d2 = new T.Mesh(new T.BoxGeometry(dl, 0.042, 0.042), M.cream);
      d2.position.set(x0 + seg / 2, hgt / 2, 0);
      d2.rotation.z = -ang;
      g.add(d2);
    }
    shadowAll(g);
    return g;
  }

  (function buildStairs() {
    var g = new T.Group();
    var xc = STAIR.x0 + STAIR.width / 2;

    for (var i = 0; i < STAIR.steps; i++) {
      var top = STAIR.rise * (i + 1);
      var zc = STAIR.z0 - STAIR.run * (i + 0.5);
      var riser = new T.Mesh(new T.BoxGeometry(STAIR.width, top, STAIR.run), M.wood);
      riser.position.set(xc, top / 2, zc);
      riser.castShadow = true;
      riser.receiveShadow = true;
      g.add(riser);

      var tread = new T.Mesh(new T.BoxGeometry(STAIR.width + 0.05, 0.06, STAIR.run + 0.05), M.woodLight);
      tread.position.set(xc, top - 0.03, zc);
      tread.castShadow = true;
      tread.receiveShadow = true;
      g.add(tread);
    }

    // 沿坡度的白色格栅栏杆（+x 侧，朝房间）
    var runTot = STAIR.run * STAIR.steps;
    var riseTot = STAIR.rise * STAIR.steps;
    var railLen = Math.hypot(runTot - STAIR.run, riseTot - STAIR.rise) + 0.06;
    var ang = Math.atan2(riseTot, runTot);

    var holder = new T.Group();
    holder.rotation.y = Math.PI / 2;                 // 本地 +x -> 世界 -z
    holder.position.set(STAIR.x0 + STAIR.width + 0.02, 0, STAIR.z0);
    var railG = buildLattice(railLen, 0.92);
    railG.position.set(STAIR.run * 0.5, STAIR.rise, 0);
    railG.rotation.z = ang;
    holder.add(railG);
    g.add(holder);

    // 起步柱 / 收头柱
    var postX = STAIR.x0 + STAIR.width + 0.02;
    var newelBot = new T.Mesh(new T.BoxGeometry(0.11, 1.08, 0.11), M.woodDark);
    newelBot.position.set(postX, 0.54, STAIR.z0 + 0.04);
    newelBot.castShadow = true;
    g.add(newelBot);

    var newelTop = new T.Mesh(new T.BoxGeometry(0.11, 1.08, 0.11), M.woodDark);
    newelTop.position.set(postX, riseTot + 0.54, STAIR.z0 - runTot + 0.04);
    newelTop.castShadow = true;
    g.add(newelTop);

    // 梯口矮台（摆陶盆与白瓷壶）
    var plinth = new T.Mesh(new T.BoxGeometry(1.3, 0.46, 1.15), M.wood);
    plinth.position.set(STAIR.x0 + STAIR.width + 0.7, 0.23, STAIR.z0 + 0.75);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    g.add(plinth);
    var plinthTop = new T.Mesh(new T.BoxGeometry(1.36, 0.06, 1.21), M.woodLight);
    plinthTop.position.set(STAIR.x0 + STAIR.width + 0.7, 0.485, STAIR.z0 + 0.75);
    g.add(plinthTop);

    // 台阶上的小盆栽
    [3, 6].forEach(function (k, idx) {
      var pot = buildSmallPlant(0.9 + idx * 0.12);
      pot.position.set(STAIR.x0 + 0.5 + idx * 0.62, STAIR.rise * (k + 1), STAIR.z0 - STAIR.run * (k + 0.5));
      pot.rotation.y = rand(-0.6, 0.6);
      g.add(pot);
    });

    // 台阶上的向日葵盆栽（参考楼梯照片）
    [2, 5].forEach(function (k, idx) {
      var sf = buildSunflower(0.6 + idx * 0.08);
      sf.position.set(STAIR.x0 + 1.32 - idx * 0.3, STAIR.rise * (k + 1), STAIR.z0 - STAIR.run * (k + 0.5));
      sf.rotation.y = rand(-0.9, 0.9);
      g.add(sf);
    });

    room.add(g);
  })();

  var LOFT = {
    y: STAIR.steps * STAIR.rise,
    x0: STAIR.x0 + STAIR.width,
    z0: STAIR.z0 - STAIR.run * STAIR.steps
  };

  (function buildLoft() {
    var g = new T.Group();
    var x0 = LOFT.x0, x1 = ALCOVE.x0, z0 = LOFT.z0, z1 = -HD;
    var w = x1 - x0, d = z0 - z1;
    var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;

    var plat = new T.Mesh(new T.BoxGeometry(w, 0.2, d), M.wood);
    plat.position.set(cx, LOFT.y - 0.1, cz);
    plat.castShadow = true;
    plat.receiveShadow = true;
    g.add(plat);

    // 补齐楼梯上方的二楼空缺：地板向左延伸到墙边
    var gx0 = -HW + 0.06, gx1 = x0 + 0.02;
    var gw2 = gx1 - gx0;
    var gap = new T.Mesh(new T.BoxGeometry(gw2, 0.2, d), M.wood);
    gap.position.set((gx0 + gx1) / 2, LOFT.y - 0.1, cz);
    gap.castShadow = true;
    gap.receiveShadow = true;
    g.add(gap);
    var gapTop = new T.Mesh(new T.BoxGeometry(gw2 - 0.03, 0.05, d - 0.03), M.woodLight);
    gapTop.position.set((gx0 + gx1) / 2, LOFT.y + 0.015, cz);
    gapTop.receiveShadow = true;
    g.add(gapTop);
    // 楼梯井一侧的收边
    var gapF = new T.Mesh(new T.BoxGeometry(gw2 + 0.06, 0.2, 0.09), M.creamTrim);
    gapF.position.set((gx0 + gx1) / 2, LOFT.y - 0.05, z0 + 0.02);
    g.add(gapF);

    var platTop = new T.Mesh(new T.BoxGeometry(w - 0.03, 0.05, d - 0.03), M.woodLight);
    platTop.position.set(cx, LOFT.y + 0.015, cz);
    platTop.receiveShadow = true;
    g.add(platTop);

    // 前缘收边
    var fascia = new T.Mesh(new T.BoxGeometry(w + 0.06, 0.2, 0.09), M.creamTrim);
    fascia.position.set(cx, LOFT.y - 0.05, z0 + 0.02);
    fascia.castShadow = true;
    g.add(fascia);

    // 支撑柱
    [[x0 + 0.15], [x1 - 0.18]].forEach(function (q) {
      var post = new T.Mesh(new T.BoxGeometry(0.16, LOFT.y, 0.16), M.woodDark);
      post.position.set(q[0], LOFT.y / 2, z0 + 0.12);
      post.castShadow = true;
      g.add(post);
    });

    // 前缘格栅栏杆
    var lat = buildLattice(w - 0.08, 0.8);
    lat.position.set(cx, LOFT.y + 0.05, z0 - 0.04);
    g.add(lat);

    // 阁楼上的坐垫与小盆栽
    var lc = softBox(0.84, 0.18, 0.84, 0.05, 0.14, M.cushionSoft);
    lc.position.set(x0 + 0.85, LOFT.y + 0.12, z0 - 0.72);
    lc.rotation.y = 0.34;
    lc.castShadow = true;
    g.add(lc);

    var lp = buildSmallPlant(1.05);
    lp.position.set(x0 + 0.32, LOFT.y + 0.04, z1 + 0.5);
    g.add(lp);

    room.add(g);
  })();

  /* 阁楼上靠墙斜放的画 */
  (function loftPaintings() {
    [
      { kind: 'landscape', w: 1.5, h: 1.1, x: -0.55, z: -HD + 0.42 },
      { kind: 'hillside', w: 1.1, h: 0.85, x: 0.62, z: -HD + 0.38 }
    ].forEach(function (p, i) {
      var art = makeFramedArt(p.kind, p.w, p.h);
      art.position.set(p.x, LOFT.y + p.h / 2 + 0.1, p.z);
      art.rotation.x = -0.16;
      art.rotation.y = 0.05 - i * 0.12;
      room.add(art);
      registerArt(art, p.kind);
    });
  })();

  /* 阁楼小角落：矮桌 + 橙色坐凳（奶油靠背）+ 花瓶 + 玩偶 + 盆栽（参考阁楼照片） */
  (function loftNook() {
    var y = LOFT.y + 0.04;
    var tx = -1.75, tz = -3.85;

    // 圆形小地毯
    var rug = new T.Mesh(new T.CylinderGeometry(1.2, 1.2, 0.03, 30), std(0xcf7b34, { roughness: 0.98 }));
    rug.position.set(tx, y + 0.016, tz);
    rug.receiveShadow = true;
    room.add(rug);

    // 矮桌（长方形浅木面 + 四条腿，参考阁楼照片）
    var top = new T.Mesh(new T.BoxGeometry(1.4, 0.09, 0.95), M.woodLight);
    top.position.set(tx, y + 0.42, tz);
    top.castShadow = true; top.receiveShadow = true;
    room.add(top);
    var apron = new T.Mesh(new T.BoxGeometry(1.32, 0.06, 0.87), M.wood);
    apron.position.set(tx, y + 0.36, tz);
    room.add(apron);
    [[-0.6, -0.38], [0.6, -0.38], [-0.6, 0.38], [0.6, 0.38]].forEach(function (p) {
      var leg = new T.Mesh(new T.BoxGeometry(0.1, 0.4, 0.1), M.woodDark);
      leg.position.set(tx + p[0], y + 0.2, tz + p[1]);
      leg.castShadow = true;
      room.add(leg);
    });

    // 桌上的花瓶 + 紫粉小花
    var vase = new T.Group();
    var vprof = [];
    for (var i = 0; i <= 10; i++) {
      var t = i / 10;
      vprof.push(new T.Vector2(0.07 + Math.sin(t * Math.PI * 0.85) * 0.07, t * 0.28));
    }
    vase.add(new T.Mesh(new T.LatheGeometry(vprof, 18), std(0xe9dccb, { roughness: 0.7 })));
    var fcol = [std(0xd98fd0, { roughness: 0.85 }), std(0xb98bd6, { roughness: 0.85 }), std(0xf3b8d8, { roughness: 0.85 })];
    for (var b = 0; b < 6; b++) {
      var aa = b / 6 * Math.PI * 2;
      var hh = 0.16 + (b % 3) * 0.05;
      var st = new T.Mesh(new T.CylinderGeometry(0.006, 0.008, hh, 4), M.leafDark);
      st.position.set(Math.cos(aa) * 0.04, 0.28 + hh / 2, Math.sin(aa) * 0.04);
      vase.add(st);
      var bud = new T.Mesh(new T.SphereGeometry(0.035, 8, 6), fcol[b % 3]);
      bud.position.set(Math.cos(aa) * 0.06, 0.28 + hh, Math.sin(aa) * 0.06);
      vase.add(bud);
    }
    vase.position.set(tx + 0.05, y + 0.48, tz - 0.05);
    shadowAll(vase);
    room.add(vase);

    // 橙色坐凳 + 奶油靠背（左右各一）
    [[-1.0, 0.62, -0.5], [0.85, 0.6, 0.3]].forEach(function (q) {
      var seat = new T.Group();
      var s1 = new T.Mesh(new T.BoxGeometry(0.92, 0.2, 0.8), M.cushionSoft);
      s1.position.y = 0.1; s1.castShadow = true; seat.add(s1);
      var s2 = new T.Mesh(new T.BoxGeometry(0.96, 0.12, 0.84), M.cushion);
      s2.position.y = 0.24; seat.add(s2);
      var back = new T.Mesh(new T.BoxGeometry(0.86, 0.55, 0.18), std(0xf0e2c6, { roughness: 0.96 }));
      back.position.set(0, 0.5, -0.32);
      seat.add(back);
      seat.position.set(tx + q[0], y + 0.02, tz + q[1]);
      seat.rotation.y = q[2];
      shadowAll(seat);
      room.add(seat);
    });

    // 坐凳上的白色玩偶
    var pl = new T.Group();
    var fur = std(0xfdf8ef, { roughness: 0.96 });
    var pb = new T.Mesh(new T.SphereGeometry(0.26, 18, 14), fur);
    pb.scale.set(0.9, 1.15, 0.85); pb.position.y = 0.28; pl.add(pb);
    var ph = new T.Mesh(new T.SphereGeometry(0.2, 18, 14), fur);
    ph.position.y = 0.62; pl.add(ph);
    [-1, 1].forEach(function (sd) {
      var ear = new T.Mesh(new T.ConeGeometry(0.05, 0.12, 8), fur);
      ear.position.set(sd * 0.08, 0.78, 0); pl.add(ear);
      var eye = new T.Mesh(new T.SphereGeometry(0.018, 8, 8), M.dark);
      eye.position.set(sd * 0.07, 0.64, 0.16); pl.add(eye);
    });
    pl.position.set(tx - 0.98, y + 0.28, tz + 0.5);
    pl.rotation.y = 0.6;
    shadowAll(pl);
    room.add(pl);

    // 盆栽
    var np = buildSmallPlant(1.25);
    np.position.set(tx + 1.35, y, tz - 0.9);
    room.add(np);
  })();

  /* =======================================================================
     8. 挂画（厚木框 + 梵高风）
     ======================================================================= */
  /* 厚木画框几何缓存：外轮廓 - 内孔，带斜切倒角，仿油画框质感 */
  function frameGeo(W, H, bw, dep) {
    var k = W.toFixed(3) + '|' + H.toFixed(3) + '|' + bw.toFixed(3) + '|' + dep.toFixed(3);
    if (_frameGeoCache[k]) return _frameGeoCache[k];
    var ox = W / 2, oy = H / 2, ix = ox - bw, iy = oy - bw;
    var s = new T.Shape();
    s.moveTo(-ox, -oy); s.lineTo(ox, -oy); s.lineTo(ox, oy); s.lineTo(-ox, oy); s.lineTo(-ox, -oy);
    var hole = new T.Path();
    hole.moveTo(-ix, -iy); hole.lineTo(-ix, iy); hole.lineTo(ix, iy); hole.lineTo(ix, -iy); hole.lineTo(-ix, -iy);
    s.holes.push(hole);
    var geo = new T.ExtrudeGeometry(s, {
      depth: dep, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.022,
      bevelSegments: 2, curveSegments: 1
    });
    geo.translate(0, 0, -dep / 2);
    _frameGeoCache[k] = geo;
    return geo;
  }
  function frameToneMat() {
    var n = (_frameTone++) % 5;
    return n === 0 ? M.frameLight : (n === 3 ? M.frameDeep : M.frame);
  }

  function makeFramedArt(kind, w, h) {
    var g = new T.Group();
    var dep = 0.1;
    var bw = clamp(Math.min(w, h) * 0.11 + 0.03, 0.06, 0.14);
    var W = w + bw * 2, H = h + bw * 2;

    var tex = artTex(kind);
    // 画心（微微内凹）
    var art = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({
      map: tex, roughness: 0.88, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12
    }));
    art.position.z = 0.012;
    g.add(art);

    // 深色内衬（画心与木框之间的阴影缝）
    var liner = new T.Mesh(new T.BoxGeometry(W + 0.006, H + 0.006, 0.05), M.frameDark);
    liner.position.z = -0.022;
    g.add(liner);

    // 厚木框（倒角斜切，立体感强）
    var frame = new T.Mesh(frameGeo(W, H, bw, dep), frameToneMat());
    frame.castShadow = true;
    g.add(frame);

    shadowAll(g);
    return g;
  }

  function mountArt(kind, w, h, x, y, z, rotY, tilt) {
    var a = makeFramedArt(kind, w, h);
    a.position.set(x, y, z);
    if (rotY) a.rotation.y = rotY;
    if (tilt) a.rotation.x = tilt;
    room.add(a);
    registerArt(a, kind);
    return a;
  }

  (function gallery() {
    // 左墙：从上到下铺满厚框油画
    var list = [
      // 顶排
      { k: 'windmill',  z:  4.30, y: 5.05, w: 1.02, h: 0.76 },
      { k: 'wheat',     z:  3.05, y: 5.05, w: 0.95, h: 0.72 },
      { k: 'cafe',      z:  1.85, y: 5.05, w: 1.05, h: 0.78 },
      { k: 'landscape', z:  0.60, y: 5.05, w: 1.10, h: 0.80 },
      { k: 'hillside',  z: -0.75, y: 5.05, w: 1.00, h: 0.74 },
      { k: 'sunflower', z: -2.05, y: 5.05, w: 1.08, h: 0.80 },
      { k: 'windmill',  z: -3.35, y: 5.05, w: 1.00, h: 0.76 },
      { k: 'wheat',     z: -4.55, y: 5.05, w: 0.92, h: 0.72 },

      // 主排
      { k: 'portrait',  z:  3.95, y: 3.72, w: 1.55, h: 1.18 },
      { k: 'starry',    z:  2.00, y: 3.72, w: 2.10, h: 1.34 },
      { k: 'bedroom',   z: -0.30, y: 3.72, w: 1.55, h: 1.20 },
      { k: 'blossom',   z: -2.15, y: 3.72, w: 1.75, h: 1.30 },
      { k: 'cafe',      z: -4.10, y: 3.72, w: 1.30, h: 1.10 },

      // 低排（避开楼梯遮挡）
      { k: 'sunflower', z:  4.15, y: 2.35, w: 1.25, h: 0.95 },
      { k: 'windmill',  z:  2.75, y: 2.35, w: 1.15, h: 0.90 },
      { k: 'hillside',  z: -2.45, y: 2.35, w: 1.30, h: 1.00 },
      { k: 'landscape', z: -3.85, y: 2.35, w: 1.20, h: 0.95 },

      // 贴地小画
      { k: 'blossom',   z:  4.30, y: 1.22, w: 1.10, h: 0.85 },
      { k: 'sunflower', z:  3.05, y: 1.22, w: 1.00, h: 0.80 }
    ];

    list.forEach(function (a) {
      mountArt(a.k, a.w, a.h, -HW + 0.075, a.y, a.z, Math.PI / 2, 0);
    });

    // 地上斜靠的画（梯口矮台边）
    var lean = makeFramedArt('windmill', 1.15, 0.9);
    lean.position.set(-3.9, 0.52, 2.55);
    lean.rotation.set(0, 0.42, 0.14);
    room.add(lean);
    registerArt(lean, 'windmill');

    var lean2 = makeFramedArt('sunflower', 1.0, 0.8);
    lean2.position.set(-2.55, 0.45, 3.35);
    lean2.rotation.set(0, -0.5, -0.12);
    room.add(lean2);
    registerArt(lean2, 'sunflower');
  })();

  /* 阁楼背墙装饰：补充画作 + 八角木框风景，避免大片空白 */
  (function loftWallDecor() {
    var zBack = -HD + 0.06;
    function octFrame(x, y, r, kind) {
      var g = new T.Group();
      var n = 9;
      function pts(rad) {
        var arr = [];
        for (var i = 0; i < n; i++) {
          var a = i / n * Math.PI * 2 - Math.PI / 2;
          var rr = rad * (1 + (i % 2 ? 0.055 : -0.035) + (i % 3 === 0 ? 0.03 : 0));
          arr.push([Math.cos(a) * rr, Math.sin(a) * rr]);
        }
        return arr;
      }
      var op = pts(r), shape = new T.Shape();
      shape.moveTo(op[0][0], op[0][1]);
      for (var i = 1; i < n; i++) shape.lineTo(op[i][0], op[i][1]);
      shape.lineTo(op[0][0], op[0][1]);
      var ip = pts(r - 0.11), hole = new T.Path();
      hole.moveTo(ip[0][0], ip[0][1]);
      for (var j = 1; j < n; j++) hole.lineTo(ip[j][0], ip[j][1]);
      hole.closePath();
      shape.holes.push(hole);
      var geo = new T.ExtrudeGeometry(shape, {
        depth: 0.1, bevelEnabled: true, bevelThickness: 0.02,
        bevelSize: 0.022, bevelSegments: 2, curveSegments: 1
      });
      geo.translate(0, 0, -0.05);
      var frame = new T.Mesh(geo, (Math.random() > 0.5 ? M.frame : M.frameDeep));
      frame.castShadow = true;
      g.add(frame);

      var tex = artTex(kind);
      var disc = new T.Mesh(new T.CircleGeometry(r - 0.13, n), new T.MeshStandardMaterial({
        map: tex, roughness: 0.88, side: T.DoubleSide,
        emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.1
      }));
      disc.position.z = 0.006;
      g.add(disc);

      var glow = new T.Sprite(new T.SpriteMaterial({
        map: texGlow, color: 0xffb877, transparent: true, opacity: 0.16,
        blending: T.AdditiveBlending, depthWrite: false
      }));
      glow.scale.setScalar(r * 3.4);
      noRaycast(glow);
      g.add(glow);
      g.position.set(x, y, zBack);
      room.add(g);
      registerArt(g, kind);
    }
    mountArt('starry', 1.55, 1.1, -3.05, 4.55, zBack, 0, 0);
    mountArt('sunflower', 1.12, 0.88, -1.42, 4.6, zBack, 0, 0);
    mountArt('blossom', 1.28, 0.95, 0.2, 4.45, zBack, 0, 0);
    mountArt('windmill', 0.9, 0.72, -4.55, 4.55, zBack, 0, 0);
    octFrame(-2.35, 3.42, 0.56, 'hillside');
    octFrame(0.82, 3.52, 0.5, 'landscape');
    octFrame(-0.62, 3.38, 0.4, 'blossom');
  })();

  /* =======================================================================
     9. 六边形壁龛（石拱龛内）+ 拱窗
     ======================================================================= */
  (function niches() {
    function niche(x, y, r, kind) {
      var g = new T.Group();
      var ring = new T.Mesh(new T.TorusGeometry(r, 0.06, 6, 6), M.frame);
      ring.rotation.z = Math.PI / 6;
      g.add(ring);
      var ring2 = new T.Mesh(new T.TorusGeometry(r - 0.09, 0.03, 6, 6), M.frameDark);
      ring2.rotation.z = Math.PI / 6;
      ring2.position.z = 0.02;
      g.add(ring2);

      var disc = new T.Mesh(new T.CircleGeometry(r - 0.1, 6), new T.MeshStandardMaterial({
        map: artTex(kind), roughness: 0.85, side: T.DoubleSide,
        emissive: 0xffffff, emissiveMap: artTex(kind), emissiveIntensity: 0.26
      }));
      disc.rotation.z = Math.PI / 6;
      disc.position.z = 0.02;
      g.add(disc);

      var glow = new T.Sprite(new T.SpriteMaterial({
        map: texGlow, color: 0xffb877, transparent: true, opacity: 0.22,
        blending: T.AdditiveBlending, depthWrite: false
      }));
      glow.scale.setScalar(r * 4.4);
      noRaycast(glow);
      g.add(glow);

      g.position.set(x, y, -HD + 0.07);
      room.add(g);
      registerArt(g, kind);
    }
    niche(3.05, 3.42, 0.60, 'hillside');
    niche(4.30, 3.86, 0.48, 'landscape');
    niche(5.42, 3.26, 0.42, 'blossom');
  })();

  var winObj;
  (function buildWindow() {
    var g = new T.Group();
    var W = 1.42, RH = 1.35, TH = 0.2, inset = 0.12;

    var outer = archShape(W, RH);
    var innerR = W / 2 - inset;
    var hole = new T.Path();
    hole.moveTo(-innerR, inset);
    hole.lineTo(innerR, inset);
    hole.lineTo(innerR, RH);
    hole.absarc(0, RH, innerR, 0, Math.PI, false);
    hole.lineTo(-innerR, inset);
    hole.closePath();
    outer.holes.push(hole);

    var frame = new T.Mesh(new T.ExtrudeGeometry(outer, {
      depth: TH, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025,
      bevelSegments: 2, curveSegments: 22, steps: 1
    }), M.creamTrim);
    frame.castShadow = true; frame.receiveShadow = true;
    g.add(frame);

    var glass = new T.Mesh(fitUV(new T.ShapeGeometry(archShape(W - inset * 2, RH - inset), 22)),
      new T.MeshBasicMaterial({ map: texWindow, color: 0xffdcb8, side: T.DoubleSide }));
    glass.position.set(0, inset, 0.07);
    g.add(glass);

    var glow = new T.Sprite(new T.SpriteMaterial({
      map: texGlow, color: 0xffb877, transparent: true, opacity: 0.2,
      blending: T.AdditiveBlending, depthWrite: false
    }));
    glow.scale.set(4.2, 4.2, 1);
    glow.position.set(0, RH * 0.7, 0.3);
    noRaycast(glow);
    g.add(glow);

    // 窗棂
    var vb = new T.Mesh(new T.BoxGeometry(0.07, RH + innerR - inset, 0.1), M.creamTrim);
    vb.position.set(0, inset + (RH + innerR - inset) / 2, 0.15);
    g.add(vb);
    var hb = new T.Mesh(new T.BoxGeometry(innerR * 2, 0.06, 0.095), M.creamTrim);
    hb.position.set(0, inset + (RH - inset) * 0.55, 0.15);
    g.add(hb);
    var arc = new T.Mesh(new T.TorusGeometry(innerR - 0.02, 0.028, 6, 24, Math.PI), M.creamTrim);
    arc.position.set(0, RH, 0.15);
    g.add(arc);
    // 窗台
    var sill = softBox(W + 0.34, 0.12, 0.3, 0.03, 0.05, M.cream);
    sill.position.set(0, -0.06, 0.08);
    g.add(sill);

    g.position.set(2.05, 2.92, -HD + 0.04);
    room.add(g);

    winObj = { group: g, glow: glow, glass: glass };

    // 地面窗光
    var pool = new T.Mesh(new T.PlaneGeometry(3.4, 3.0), new T.MeshBasicMaterial({
      map: texGlow, color: 0xffc48a, transparent: true, opacity: 0.18,
      blending: T.AdditiveBlending, depthWrite: false
    }));
    noRaycast(pool);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(2.6, 0.014, -3.9);
    room.add(pool);
    winObj.pool = pool;
  })();

  /* =======================================================================
     10. 植物
     ======================================================================= */
  function buildMonstera(scale) {
    var g = new T.Group();
    scale = scale || 1;
    var pot = new T.Mesh(new T.CylinderGeometry(0.26, 0.2, 0.34, 18), M.terracotta);
    pot.position.y = 0.17; pot.castShadow = true;
    g.add(pot);
    var soil = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.05, 18), M.woodDark);
    soil.position.y = 0.33;
    g.add(soil);

    var leafGeo = new T.SphereGeometry(0.5, 10, 8);
    var n = 8;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + rand(-0.3, 0.3);
      var leaf = new T.Mesh(leafGeo, i % 2 ? M.leaf : M.leafDark);
      leaf.scale.set(0.34, 0.62, 0.1);
      var rad = rand(0.08, 0.22);
      leaf.position.set(Math.cos(a) * rad, 0.42 + rand(0.18, 0.5), Math.sin(a) * rad);
      leaf.rotation.set(rand(-0.5, 0.5), -a, rand(-0.7, 0.7));
      leaf.castShadow = true;
      g.add(leaf);
    }
    var stem = new T.Mesh(new T.CylinderGeometry(0.04, 0.05, 0.6, 6), M.leafDark);
    stem.position.y = 0.55;
    g.add(stem);
    g.scale.setScalar(scale);
    shadowAll(g);
    return g;
  }

  function buildSunflower(scale) {
    var g = new T.Group();
    scale = scale || 1;
    var pot = new T.Mesh(new T.CylinderGeometry(0.24, 0.18, 0.3, 16), M.terracotta);
    pot.position.y = 0.15; pot.castShadow = true;
    g.add(pot);
    var rim = new T.Mesh(new T.TorusGeometry(0.235, 0.03, 8, 18), M.petalDeep);
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.3;
    g.add(rim);

    var heights = [0.95, 1.25, 1.1, 0.8];
    for (var i = 0; i < heights.length; i++) {
      var hh = heights[i];
      var lean = rand(-0.15, 0.15);
      var stem = new T.Mesh(new T.CylinderGeometry(0.02, 0.03, hh, 6), M.leafDark);
      stem.position.set(lean, 0.3 + hh / 2, rand(-0.1, 0.1));
      stem.rotation.z = -lean * 0.6;
      g.add(stem);
      // 叶
      var lf = new T.Mesh(new T.SphereGeometry(0.5, 8, 6), M.leaf);
      lf.scale.set(0.16, 0.04, 0.24);
      lf.position.set(lean + 0.08, 0.6 + hh * 0.4, 0);
      lf.rotation.z = 0.5;
      g.add(lf);
      // 花盘
      var head = new T.Group();
      var center = new T.Mesh(new T.SphereGeometry(0.14, 14, 10), M.seed);
      center.scale.set(1, 1, 0.6);
      head.add(center);
      for (var p = 0; p < 13; p++) {
        var pa = p / 13 * Math.PI * 2;
        var petal = new T.Mesh(new T.ConeGeometry(0.07, 0.26, 4), i % 2 ? M.petal : M.petalDeep);
        petal.position.set(Math.cos(pa) * 0.2, Math.sin(pa) * 0.2, 0);
        petal.rotation.z = pa - Math.PI / 2;
        head.add(petal);
      }
      head.position.set(lean, 0.3 + hh, rand(-0.1, 0.1));
      head.rotation.x = rand(-0.25, 0.1);
      head.rotation.y = rand(-0.4, 0.4);
      g.add(head);
    }
    g.scale.setScalar(scale);
    shadowAll(g);
    return g;
  }

  function buildSmallPlant(scale) {
    var g = new T.Group();
    scale = scale || 1;
    var pot = new T.Mesh(new T.CylinderGeometry(0.16, 0.12, 0.22, 14), M.terracotta);
    pot.position.y = 0.11; pot.castShadow = true;
    g.add(pot);
    var leafGeo = new T.SphereGeometry(0.5, 8, 6);
    for (var i = 0; i < 6; i++) {
      var a = (i / 6) * Math.PI * 2;
      var leaf = new T.Mesh(leafGeo, i % 2 ? M.leaf : M.leafLight);
      leaf.scale.set(0.16, 0.34, 0.06);
      leaf.position.set(Math.cos(a) * 0.06, 0.28 + rand(0.05, 0.2), Math.sin(a) * 0.06);
      leaf.rotation.set(rand(-0.4, 0.4), -a, rand(-0.5, 0.5));
      leaf.castShadow = true;
      g.add(leaf);
    }
    g.scale.setScalar(scale);
    return g;
  }

  /* 拱龛两侧与阁楼柱边的植物群 */
  (function leftPlants() {
    var p1 = buildMonstera(1.7);
    p1.position.set(1.68, 0, -2.28);
    p1.rotation.y = 1.15;
    room.add(p1);

    var p2 = buildMonstera(1.3);
    p2.position.set(5.92, 0, -2.2);
    p2.rotation.y = -0.5;
    room.add(p2);

    var p3 = buildSmallPlant(1.35);
    p3.position.set(-3.1, 0, -2.15);
    room.add(p3);

    var p4 = buildSmallPlant(1.15);
    p4.position.set(-4.05, 0.485, 1.62);
    room.add(p4);
  })();

  /* =======================================================================
     11. 沙发（橙垫）
     ======================================================================= */
  var sofa;
  (function buildSofa() {
    var g = new T.Group();
    var D = 1.22, W = 2.9, seatH = 0.44;

    var base = softBox(D, seatH, W, 0.09, 0.14, M.cushionDeep);
    base.position.y = seatH / 2;
    g.add(base);

    var back = softBox(0.34, 1.05, W, 0.1, 0.16, M.cushion);
    back.position.set(-D / 2 + 0.16, seatH + 0.5, 0);
    g.add(back);

    [-1, 1].forEach(function (s) {
      var arm = softBox(D * 0.98, 0.44, 0.3, 0.11, 0.14, M.cushion);
      arm.position.set(0, seatH + 0.17, s * (W / 2 - 0.15));
      g.add(arm);
      var armTop = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, D * 0.98, 14), M.cushionSoft);
      armTop.rotation.z = Math.PI / 2;
      armTop.position.set(0, seatH + 0.39, s * (W / 2 - 0.15));
      g.add(armTop);
    });

    [-1, 1].forEach(function (s) {
      var c = softBox(D - 0.36, 0.2, W / 2 - 0.18, 0.08, 0.1, M.cushion);
      c.position.set(0.06, seatH + 0.08, s * (W / 4 - 0.04));
      g.add(c);
    });

    [-1, 1].forEach(function (s) {
      var p = softBox(0.2, 0.6, 0.64, 0.08, 0.12, M.cushionSoft);
      p.position.set(-D / 2 + 0.36, seatH + 0.38, s * 0.74);
      p.rotation.z = -0.16;
      g.add(p);
    });

    // 抱枕
    var pil = softBox(0.2, 0.5, 0.5, 0.08, 0.14, M.cushionPale);
    pil.position.set(-D / 2 + 0.46, seatH + 0.32, 1.02);
    pil.rotation.set(0.12, 0.12, -0.32);
    g.add(pil);

    // 搭毯
    var throwB = softBox(0.5, 0.08, 0.92, 0.03, 0.06, M.creamTrim);
    throwB.position.set(0.06, seatH + 0.6, -1.1);
    throwB.rotation.z = 0.06;
    g.add(throwB);

    [[-0.45, -1.32], [-0.45, 1.32], [0.45, -1.32], [0.45, 1.32]].forEach(function (p) {
      var leg = new T.Mesh(new T.CylinderGeometry(0.05, 0.045, 0.1, 8), M.woodDark);
      leg.position.set(p[0], 0.05, p[1]);
      g.add(leg);
    });

    g.scale.setScalar(1.02);
    g.position.set(-1.05, 0, -4.5);
    g.rotation.y = -Math.PI / 2;
    shadowAll(g);
    room.add(g);
    sofa = g;
  })();

  /* =======================================================================
     12. 圆木桌
     ======================================================================= */
  var tableObj;
  (function buildTable() {
    var g = new T.Group();
    var R = 1.0, topY = 0.62;

    var top = new T.Mesh(new T.CylinderGeometry(R, R, 0.11, 44), M.woodLight);
    top.position.y = topY;
    top.castShadow = true; top.receiveShadow = true;
    g.add(top);
    var topEdge = new T.Mesh(new T.TorusGeometry(R - 0.02, 0.045, 8, 48), M.wood);
    topEdge.rotation.x = Math.PI / 2;
    topEdge.position.y = topY + 0.05;
    g.add(topEdge);

    for (var i = 0; i < 4; i++) {
      var a = Math.PI / 4 + i * Math.PI / 2;
      var leg = new T.Mesh(new T.CylinderGeometry(0.06, 0.05, topY, 8), M.woodDark);
      leg.position.set(Math.cos(a) * 0.7, topY / 2, Math.sin(a) * 0.7);
      leg.rotation.set(Math.sin(a) * 0.06, 0, -Math.cos(a) * 0.06);
      leg.castShadow = true;
      g.add(leg);
    }
    var ring = new T.Mesh(new T.TorusGeometry(0.6, 0.035, 6, 40), M.woodDark);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2;
    g.add(ring);

    /* 书 */
    var book = new T.Group();
    book.add(softBox(0.54, 0.05, 0.38, 0.014, 0.02, M.bookGreen));
    var pages = softBox(0.5, 0.034, 0.345, 0.008, 0.01, M.cream);
    pages.position.y = 0.04;
    book.add(pages);
    var cover2 = softBox(0.54, 0.03, 0.38, 0.01, 0.02, M.bookGreen);
    cover2.position.y = 0.066;
    book.add(cover2);
    var mark = new T.Mesh(new T.BoxGeometry(0.035, 0.12, 0.005), M.bookRed);
    mark.position.set(0.14, 0.06, 0.2);
    mark.rotation.x = 0.5;
    book.add(mark);
    book.position.set(-0.02, topY + 0.07, -0.05);
    book.rotation.y = 0.42;
    shadowAll(book);
    g.add(book);

    /* 杯 + 蜡烛 */
    var cup = new T.Mesh(new T.CylinderGeometry(0.08, 0.065, 0.11, 16), M.cream);
    cup.position.set(0.42, topY + 0.09, 0.34);
    cup.castShadow = true;
    g.add(cup);
    var candle = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.18, 12),
      new T.MeshStandardMaterial({ color: 0xfff2dd, roughness: 0.7, emissive: 0xffb060, emissiveIntensity: 0.5 }));
    candle.position.set(-0.4, topY + 0.14, 0.34);
    g.add(candle);

    g.position.set(-0.95, 0, -2.72);
    shadowAll(g);
    room.add(g);
    tableObj = { group: g, book: book };
  })();

  /* =======================================================================
     13. 睡着的白猫
     ======================================================================= */
  var cat;
  (function buildCat() {
    var g = new T.Group();
    var fur = std(0xfff7ec, { roughness: 0.95 });
    var furShade = std(0xf0e3d2, { roughness: 0.95 });

    var body = new T.Mesh(new T.SphereGeometry(0.4, 22, 16), fur);
    body.scale.set(1.15, 0.72, 0.86);
    body.position.set(-0.04, 0.24, 0);
    g.add(body);

    var hip = new T.Mesh(new T.SphereGeometry(0.27, 18, 14), fur);
    hip.scale.set(0.95, 0.9, 1.0);
    hip.position.set(-0.28, 0.22, 0);
    g.add(hip);

    var head = new T.Mesh(new T.SphereGeometry(0.26, 20, 16), fur);
    head.position.set(0.41, 0.3, 0.02);
    head.scale.set(1.0, 0.92, 1.0);
    g.add(head);

    [-1, 1].forEach(function (s) {
      var ear = new T.Mesh(new T.ConeGeometry(0.1, 0.2, 4), fur);
      ear.position.set(0.37, 0.5, s * 0.15);
      ear.rotation.set(s * 0.32, Math.PI / 4, 0);
      g.add(ear);
      var inner = new T.Mesh(new T.ConeGeometry(0.058, 0.12, 4), std(0xf0b3b6, { roughness: 0.9 }));
      inner.position.set(0.385, 0.492, s * 0.148);
      inner.rotation.set(s * 0.32, Math.PI / 4, 0);
      g.add(inner);
    });

    [-1, 1].forEach(function (s) {
      var eye = new T.Mesh(new T.TorusGeometry(0.042, 0.0095, 6, 14, Math.PI), M.dark);
      eye.rotation.set(Math.PI / 2, Math.PI / 2, Math.PI);
      eye.position.set(0.618, 0.335, s * 0.108);
      g.add(eye);
    });

    var nose = new T.Mesh(new T.SphereGeometry(0.022, 10, 8), std(0xf0a9ab, { roughness: 0.8 }));
    nose.position.set(0.645, 0.288, 0.004);
    nose.scale.set(1, 0.8, 1.3);
    g.add(nose);

    [-1, 1].forEach(function (s) {
      var paw = new T.Mesh(new T.SphereGeometry(0.075, 12, 10), furShade);
      paw.scale.set(1.5, 0.62, 1);
      paw.position.set(0.4, 0.075, s * 0.17);
      g.add(paw);
    });

    var tailCurve = new T.CatmullRomCurve3([
      new T.Vector3(-0.42, 0.3, 0.12),
      new T.Vector3(-0.5, 0.16, -0.18),
      new T.Vector3(-0.28, 0.075, -0.4),
      new T.Vector3(0.06, 0.07, -0.42),
      new T.Vector3(0.28, 0.08, -0.3)
    ]);
    g.add(new T.Mesh(new T.TubeGeometry(tailCurve, 24, 0.062, 8, false), fur));

    shadowAll(g);
    g.scale.setScalar(1.42);
    g.position.set(-1.5, 0.02, 1.8);
    g.rotation.y = 0.9;
    room.add(g);
    cat = g;

    var rug = new T.Mesh(new T.CircleGeometry(1.9, 48), M.rug);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-0.9, 0.008, 1.25);
    rug.receiveShadow = true;
    room.add(rug);
  })();

  /* =======================================================================
     14. 礼物盒
     ======================================================================= */
  var giftObj;
  (function buildGift() {
    var g = new T.Group();
    var W = 0.74, H = 0.6;

    var box = softBox(W, H, W, 0.03, 0.04, M.creamTrim);
    box.position.y = H / 2;
    g.add(box);

    var ribbonMat = std(0xd98a34, {
      roughness: 0.5, metalness: 0.2,
      emissive: 0xffb060, emissiveIntensity: 0.16
    });

    var r1 = new T.Mesh(new T.BoxGeometry(0.11, H + 0.012, W + 0.012), ribbonMat);
    r1.position.set(0, H / 2, 0);
    g.add(r1);
    var r2 = new T.Mesh(new T.BoxGeometry(W + 0.012, H + 0.014, 0.11), ribbonMat);
    r2.position.set(0, H / 2, 0);
    g.add(r2);

    var lidGroup = new T.Group();
    var lid = softBox(W + 0.09, 0.13, W + 0.09, 0.03, 0.04, M.cushionPale);
    lid.position.y = 0.065;
    lidGroup.add(lid);
    [0, Math.PI / 2].forEach(function (rot) {
      var lr = new T.Mesh(new T.BoxGeometry(0.11, 0.148, W + 0.1), ribbonMat);
      lr.position.y = 0.065;
      lr.rotation.y = rot;
      lidGroup.add(lr);
    });
    [-1, 1].forEach(function (s) {
      var loop = new T.Mesh(new T.TorusGeometry(0.1, 0.038, 8, 18), ribbonMat);
      loop.position.set(s * 0.09, 0.19, 0);
      loop.rotation.set(Math.PI / 2, 0, s * 0.5);
      loop.scale.set(1, 1, 0.75);
      lidGroup.add(loop);
    });
    var knot = new T.Mesh(new T.SphereGeometry(0.045, 12, 10), ribbonMat);
    knot.position.y = 0.17;
    lidGroup.add(knot);

    lidGroup.position.y = H;
    g.add(lidGroup);

    shadowAll(g);
    g.scale.setScalar(1.1);
    g.position.set(0.2, 0, -0.75);
    g.rotation.y = -0.34;
    room.add(g);
    giftObj = { group: g, lid: lidGroup };
  })();

  /* =======================================================================
     15. 留声机（右侧边几上）
     ======================================================================= */
  var gramoObj;
  (function buildGramophone() {
    var g = new T.Group();
    var CW = 1.2, CH = 0.74, CD = 0.66;

    var cab = softBox(CW, CH, CD, 0.045, 0.05, M.wood);
    cab.position.y = CH / 2;
    g.add(cab);
    var face = softBox(CW - 0.16, CH - 0.22, 0.03, 0.012, 0.02, M.woodLight);
    face.position.set(0, CH / 2, CD / 2 + 0.006);
    g.add(face);

    var top = softBox(CW + 0.08, 0.06, CD + 0.08, 0.02, 0.03, M.woodLight);
    top.position.y = CH + 0.03;
    g.add(top);

    var platter = new T.Mesh(new T.CylinderGeometry(0.34, 0.34, 0.045, 30), M.dark);
    platter.position.set(-0.24, CH + 0.08, 0);
    g.add(platter);
    var record = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 0.012, 30),
      new T.MeshStandardMaterial({ color: 0x201d24, roughness: 0.4, metalness: 0.15 }));
    record.position.set(-0.24, CH + 0.11, 0);
    g.add(record);
    var label = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 0.014, 18), std(0xe8b06a, { roughness: 0.6 }));
    label.position.set(-0.24, CH + 0.116, 0);
    g.add(label);

    // 喇叭
    var hornGroup = new T.Group();
    var pts = [];
    for (var i = 0; i <= 20; i++) {
      var t = i / 20;
      pts.push(new T.Vector2(0.04 + Math.pow(t, 2.6) * 0.42, t * 0.78));
    }
    var horn = new T.Mesh(new T.LatheGeometry(pts, 36),
      new T.MeshStandardMaterial({
        color: 0xf3c47e, roughness: 0.28, metalness: 0.92,
        envMapIntensity: 2.2, emissive: 0x4a3413, emissiveIntensity: 0.35,
        side: T.DoubleSide
      }));
    horn.castShadow = true;
    hornGroup.add(horn);
    var rimRing = new T.Mesh(new T.TorusGeometry(0.46, 0.026, 8, 36), M.gold);
    rimRing.rotation.x = Math.PI / 2;
    rimRing.position.y = 0.78;
    hornGroup.add(rimRing);
    var neck = new T.Mesh(new T.CylinderGeometry(0.045, 0.04, 0.26, 12), M.goldSoft);
    neck.position.y = -0.1;
    hornGroup.add(neck);
    hornGroup.position.set(-0.5, CH + 0.26, 0.02);
    hornGroup.rotation.set(0.42, 0, 0.12);
    g.add(hornGroup);

    shadowAll(g);
    g.scale.setScalar(1.0);
    g.position.set(1.55, 0, 1.72);
    g.rotation.y = -0.65;
    room.add(g);
    gramoObj = { group: g, horn: hornGroup, record: record };
  })();

  /* 留声机边几 */
  (function sideTable() {
    var g = new T.Group();
    var top = new T.Mesh(new T.CylinderGeometry(0.55, 0.55, 0.08, 24), M.woodLight);
    top.position.y = 0.5;
    top.castShadow = true; top.receiveShadow = true;
    g.add(top);
    for (var i = 0; i < 3; i++) {
      var a = i * Math.PI * 2 / 3 + 0.4;
      var leg = new T.Mesh(new T.CylinderGeometry(0.04, 0.035, 0.5, 7), M.woodDark);
      leg.position.set(Math.cos(a) * 0.4, 0.25, Math.sin(a) * 0.4);
      leg.castShadow = true;
      g.add(leg);
    }
    g.position.set(1.55, 0, 1.72);
    room.add(g);
  })();

  /* =======================================================================
     16. 画架 + 花瓣地垫
     ======================================================================= */
  (function buildEasel() {
    var g = new T.Group();
    var woodMat = M.wood;
    // 三脚
    [[-0.5, 0.4, 0.15], [0.5, 0.4, 0.15], [0, 0.55, -0.35]].forEach(function (p, i) {
      var leg = new T.Mesh(new T.BoxGeometry(0.06, 2.2, 0.06), woodMat);
      leg.position.set(p[0], 1.1, p[2]);
      leg.rotation.x = i === 2 ? -0.22 : 0.08;
      leg.rotation.z = p[0] * 0.14;
      leg.castShadow = true;
      g.add(leg);
    });
    // 横档
    var cross = new T.Mesh(new T.BoxGeometry(1.0, 0.05, 0.05), woodMat);
    cross.position.set(0, 0.9, 0.1);
    g.add(cross);
    // 画布托
    var tray = new T.Mesh(new T.BoxGeometry(1.1, 0.06, 0.16), M.woodDark);
    tray.position.set(0, 1.25, 0.18);
    g.add(tray);
    // 画布
    var canvasArt = new T.Mesh(new T.PlaneGeometry(1.15, 0.9), new T.MeshStandardMaterial({
      map: artTex('landscape'), roughness: 0.9, side: T.DoubleSide
    }));
    canvasArt.position.set(0, 1.75, 0.16);
    canvasArt.rotation.x = -0.06;
    g.add(canvasArt);
    var canvasBack = new T.Mesh(new T.BoxGeometry(1.2, 0.95, 0.05), M.cream);
    canvasBack.position.set(0, 1.75, 0.12);
    canvasBack.rotation.x = -0.06;
    g.add(canvasBack);

    g.position.set(2.48, 0, 0.55);
    g.rotation.y = 0.5;
    g.scale.setScalar(0.8);
    shadowAll(g);
    room.add(g);
    registerCommission(g, '画架上的画');   // 画架上的画：点击打开「和你的约稿」作品页

    /* 旁边斜靠一块未装框的画布（参考石拱龛照片） */
    var leanCanvas = new T.Group();
    var lb = new T.Mesh(new T.BoxGeometry(0.95, 0.72, 0.05), M.cream);
    leanCanvas.add(lb);
    var la = new T.Mesh(new T.PlaneGeometry(0.88, 0.66), new T.MeshStandardMaterial({
      map: artTex('hillside'), roughness: 0.9, side: T.DoubleSide,
      emissive: 0xffffff, emissiveMap: artTex('hillside'), emissiveIntensity: 0.06
    }));
    la.position.z = 0.032;
    leanCanvas.add(la);
    leanCanvas.position.set(4.92, 0.36, -1.52);
    leanCanvas.rotation.set(-0.62, 0.16, 0.02);
    shadowAll(leanCanvas);
    room.add(leanCanvas);
    /* 立着的画板（倚墙画布）：仅作场景摆件，不响应点击、不弹任何页面 */
  })();

  /* 向日葵花瓣坐垫（参考石拱龛照片里的地垫）：双层花瓣 + 蓬松中心 + 棕色纽扣 */
  function makeFlowerCushion(scl) {
    var g = new T.Group();
    var nOut = 10, nIn = 8;
    // 外圈大花瓣
    for (var i = 0; i < nOut; i++) {
      var a = i / nOut * Math.PI * 2;
      var petal = new T.Mesh(new T.SphereGeometry(0.34, 14, 10), i % 2 ? M.cushionSoft : M.cushion);
      petal.scale.set(1.2, 0.3, 0.72);
      petal.position.set(Math.cos(a) * 0.52, 0.1, Math.sin(a) * 0.52);
      petal.rotation.y = -a;
      petal.rotation.z = -Math.cos(a) * 0.14;
      g.add(petal);
    }
    // 内圈花瓣（错位、略高、颜色更亮）
    for (var k = 0; k < nIn; k++) {
      var a2 = (k + 0.5) / nIn * Math.PI * 2;
      var p2 = new T.Mesh(new T.SphereGeometry(0.26, 12, 10), k % 2 ? M.petal : M.petalDeep);
      p2.scale.set(1.12, 0.34, 0.7);
      p2.position.set(Math.cos(a2) * 0.3, 0.17, Math.sin(a2) * 0.3);
      p2.rotation.y = -a2;
      g.add(p2);
    }
    // 蓬松中心
    var dome = new T.Mesh(new T.SphereGeometry(0.4, 22, 14, 0, 6.283, 0, Math.PI / 2), M.cushionDeep);
    dome.scale.set(1, 0.55, 1); dome.position.y = 0.12;
    g.add(dome);
    // 棕色纽扣 + 中心小鼓包
    var btn = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 0.05, 18), M.seed);
    btn.position.y = 0.335; g.add(btn);
    var btnt = new T.Mesh(new T.SphereGeometry(0.05, 10, 8), M.seed);
    btnt.scale.y = 0.6; btnt.position.y = 0.375; g.add(btnt);
    // 放射缝线
    for (var s = 0; s < 10; s++) {
      var aa = s / 10 * Math.PI * 2;
      var seam = new T.Mesh(new T.BoxGeometry(0.016, 0.02, 0.22), M.seed);
      seam.position.set(Math.cos(aa) * 0.12, 0.33, Math.sin(aa) * 0.12);
      seam.rotation.y = -aa; seam.rotation.x = 0.05;
      g.add(seam);
    }
    shadowAll(g);
    g.scale.setScalar(scl || 1);
    return g;
  }

  var _fc1 = makeFlowerCushion(1.0);
  _fc1.position.set(-2.15, 0, 2.15);
  _fc1.rotation.y = 1.15;
  room.add(_fc1);

  var _fc2 = makeFlowerCushion(0.92);
  _fc2.position.set(1.95, 0, -1.05);
  _fc2.rotation.y = -0.35;
  room.add(_fc2);

  /* 开盖披萨盒（参考截图：纸盒 + 缺一块的披萨 + 腊肠与罗勒） */
  (function pizzaBox() {
    var g = new T.Group();
    var card = std(0xc9955f, { roughness: 0.9 });
    var cardIn = std(0xa87343, { roughness: 0.92 });

    // 盒底 + 内壁
    var base = new T.Mesh(new T.BoxGeometry(0.8, 0.05, 0.8), card);
    base.position.y = 0.025;
    g.add(base);
    var bw = 0.8, wh = 0.09;
    [
      [bw, wh, 0, -0.4],
      [bw, wh, 0, 0.4]
    ].forEach(function (p) {
      var wall = new T.Mesh(new T.BoxGeometry(p[0], p[1], 0.03), cardIn);
      wall.position.set(p[2], 0.07, p[3]);
      g.add(wall);
    });
    [-0.4, 0.4].forEach(function (xw) {
      var wall = new T.Mesh(new T.BoxGeometry(0.03, wh, bw), cardIn);
      wall.position.set(xw, 0.07, 0);
      g.add(wall);
    });

    // 披萨（扇形缺口：a1=0 → a2=0.5 缺一块）
    var R = 0.31;
    var shape = new T.Shape();
    shape.moveTo(0, 0);
    shape.absarc(0, 0, R, 0.5, Math.PI * 2, false);
    shape.lineTo(0, 0);
    var pgeo = new T.ExtrudeGeometry(shape, { depth: 0.045, bevelEnabled: false, curveSegments: 26 });
    pgeo.rotateX(-Math.PI / 2);
    var pizza = new T.Mesh(pgeo, std(0xf0cf6e, { roughness: 0.85 }));
    pizza.position.y = 0.05;
    g.add(pizza);

    // 饼边（弧长与缺口对应：2π-0.5）
    var crust = new T.Mesh(new T.TorusGeometry(R - 0.035, 0.036, 8, 30, Math.PI * 2 - 0.5), std(0xd9a254, { roughness: 0.9 }));
    crust.rotation.x = Math.PI / 2;
    crust.position.y = 0.078;
    g.add(crust);

    // 腊肠片 + 罗勒碎
    for (var pi = 0; pi < 9; pi++) {
      var pa = 0.8 + (pi / 9) * (Math.PI * 2 - 0.9);
      var pr = 0.06 + (pi % 3) * 0.07;
      var pep = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.012, 10), std(0xd8503c, { roughness: 0.8 }));
      pep.position.set(Math.cos(pa) * pr, 0.102, -Math.sin(pa) * pr);
      g.add(pep);
    }
    for (var bi = 0; bi < 7; bi++) {
      var ba = 0.7 + (bi / 7) * (Math.PI * 2 - 0.9);
      var br = 0.1 + (bi % 4) * 0.055;
      var bas = new T.Mesh(new T.BoxGeometry(0.032, 0.01, 0.022), M.leaf);
      bas.position.set(Math.cos(ba) * br, 0.1, -Math.sin(ba) * br);
      bas.rotation.y = rand(0, 3);
      g.add(bas);
    }

    // 开盖（绕后缘铰链向后翻开，立起倚在留声机边几上）
    var hinge = new T.Group();
    hinge.position.set(0, 0.06, -0.4);
    var lid = new T.Mesh(new T.BoxGeometry(0.82, 0.035, 0.8), card);
    lid.position.set(0, 0, 0.4);
    hinge.add(lid);
    hinge.rotation.x = -1.52;
    g.add(hinge);

    g.position.set(1.05, 0, 2.42);
    g.rotation.y = -0.59;
    g.scale.setScalar(1.12);
    shadowAll(g);
    room.add(g);
  })();

  /* =======================================================================
     17. 灯串（沿挂画墙 + 藤枝）
     ======================================================================= */
  var lightStrings = [];

  function buildStringLights(a, b, scallops, sag, delay) {
    var g = new T.Group();
    var pts = [], segs = 96;
    for (var i = 0; i <= segs; i++) {
      var t = i / segs;
      var p = new T.Vector3().lerpVectors(a, b, t);
      p.y -= Math.abs(Math.sin(t * scallops * Math.PI)) * sag;
      pts.push(p);
    }
    var curve = new T.CatmullRomCurve3(pts);
    g.add(new T.Mesh(
      new T.TubeGeometry(curve, 120, 0.011, 5, false),
      new T.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 })
    ));

    var len = curve.getLength(), step = 0.34, bulbPts = [];
    for (var d = 0.15; d < len; d += step) bulbPts.push(curve.getPointAt(d / len));

    var bulbMat = new T.MeshStandardMaterial({
      color: 0xfff0d4, roughness: 0.35,
      emissive: 0xffb063, emissiveIntensity: 1.4
    });
    var inst = new T.InstancedMesh(new T.SphereGeometry(0.058, 10, 8), bulbMat, bulbPts.length);
    var dummy = new T.Object3D();
    bulbPts.forEach(function (p, i) {
      dummy.position.set(p.x, p.y - 0.04, p.z);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    g.add(inst);

    var pos = new Float32Array(bulbPts.length * 3);
    bulbPts.forEach(function (p, i) {
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y - 0.04; pos[i * 3 + 2] = p.z;
    });
    var pg = new T.BufferGeometry();
    pg.setAttribute('position', new T.BufferAttribute(pos, 3));
    var pm = new T.PointsMaterial({
      map: texGlow, color: 0xffbb77, size: 0.8, sizeAttenuation: true,
      transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false
    });
    var clouds = new T.Points(pg, pm);
    noRaycast(clouds);
    g.add(clouds);

    room.add(g);
    lightStrings.push({ mat: bulbMat, glow: pm, delay: delay || 0, base: 2.0 });
    return g;
  }

  // 沿左画廊墙顶部
  buildStringLights(
    new T.Vector3(-HW + 0.18, 5.62, 4.95),
    new T.Vector3(-HW + 0.18, 5.62, -4.95),
    7, 0.30, 0
  );
  // 沿画廊墙中段（穿行在画与画之间）
  buildStringLights(
    new T.Vector3(-HW + 0.2, 4.42, 4.8),
    new T.Vector3(-HW + 0.2, 4.36, 1.4),
    3, 0.24, 0.45
  );
  // 阁楼栏杆
  buildStringLights(
    new T.Vector3(-4.05, LOFT.y + 0.92, LOFT.z0 - 0.08),
    new T.Vector3(1.18, LOFT.y + 0.92, LOFT.z0 - 0.08),
    4, 0.22, 0.8
  );
  // 拱洞口横挂
  buildStringLights(
    new T.Vector3(1.95, 4.34, ALCOVE.z + 0.14),
    new T.Vector3(5.7, 4.34, ALCOVE.z + 0.14),
    4, 0.26, 1.1
  );
  // 阁楼背墙顶部
  buildStringLights(
    new T.Vector3(-4.2, 5.15, -HD + 0.14),
    new T.Vector3(1.15, 5.05, -HD + 0.14),
    5, 0.26, 1.3
  );

  /* 藤枝（挂画墙上的褐色枝条 + 叶子） */
  (function vines() {
    function branch(a, b, c) {
      var curve = new T.CatmullRomCurve3([a, b, c]);
      var m = new T.Mesh(new T.TubeGeometry(curve, 24, 0.028, 6, false),
        new T.MeshStandardMaterial({ color: 0x6a4a2c, roughness: 0.9 }));
      room.add(m);
      // 叶
      for (var i = 0; i < 5; i++) {
        var t = rand(0.15, 0.9);
        var p = curve.getPointAt(t);
        var leaf = new T.Mesh(new T.SphereGeometry(0.5, 8, 6), i % 2 ? M.leaf : M.leafDark);
        leaf.scale.set(0.14, 0.04, 0.22);
        leaf.position.copy(p);
        leaf.rotation.set(rand(-0.6, 0.6), rand(0, 6.28), rand(-0.6, 0.6));
        leaf.castShadow = true;
        room.add(leaf);
      }
    }
    // 画廊墙上攀爬的藤
    branch(
      new T.Vector3(-HW + 0.14, 0.9, 4.1),
      new T.Vector3(-HW + 0.18, 2.7, 3.35),
      new T.Vector3(-HW + 0.14, 4.75, 3.0)
    );
    branch(
      new T.Vector3(-HW + 0.14, 0.9, 2.9),
      new T.Vector3(-HW + 0.18, 2.4, 2.2),
      new T.Vector3(-HW + 0.14, 4.9, 2.5)
    );
    branch(
      new T.Vector3(-HW + 0.14, 1.1, -1.1),
      new T.Vector3(-HW + 0.18, 2.9, -1.8),
      new T.Vector3(-HW + 0.14, 4.8, -2.4)
    );
    branch(
      new T.Vector3(-HW + 0.14, 1.3, -3.4),
      new T.Vector3(-HW + 0.18, 3.0, -4.0),
      new T.Vector3(-HW + 0.14, 4.7, -4.35)
    );
    // 拱龛两侧
    branch(
      new T.Vector3(1.74, 0.7, ALCOVE.z + 0.08),
      new T.Vector3(1.86, 2.5, ALCOVE.z + 0.1),
      new T.Vector3(2.12, 4.15, ALCOVE.z + 0.08)
    );
    branch(
      new T.Vector3(5.68, 0.7, ALCOVE.z + 0.08),
      new T.Vector3(5.56, 2.6, ALCOVE.z + 0.1),
      new T.Vector3(5.34, 4.2, ALCOVE.z + 0.08)
    );
    // 阁楼背墙攀爬藤
    branch(
      new T.Vector3(-4.1, 2.9, -HD + 0.14),
      new T.Vector3(-1.6, 4.1, -HD + 0.16),
      new T.Vector3(0.9, 5.2, -HD + 0.14)
    );
  })();

  /* =======================================================================
     18. 纸灯笼 / 光球
     ======================================================================= */
  var lanterns = [];

  function buildLantern(x, y, z, r) {
    var g = new T.Group();
    var ball = new T.Mesh(new T.SphereGeometry(r, 22, 16),
      new T.MeshStandardMaterial({
        color: 0xfff4e2, roughness: 0.6,
        emissive: 0xffc98d, emissiveIntensity: 1.1,
        transparent: true, opacity: 0.97
      }));
    g.add(ball);
    var halo = new T.Sprite(new T.SpriteMaterial({
      map: texGlow, color: 0xffb474, transparent: true, opacity: 0.55,
      blending: T.AdditiveBlending, depthWrite: false
    }));
    var haloSize = r * 6.4;
    halo.scale.setScalar(haloSize);
    noRaycast(halo);
    g.add(halo);
    var hook = new T.Mesh(new T.TorusGeometry(r * 0.16, r * 0.035, 6, 12), M.goldSoft);
    hook.position.y = r * 1.02;
    hook.rotation.x = Math.PI / 2;
    g.add(hook);
    g.position.set(x, y, z);
    room.add(g);
    lanterns.push({ g: g, halo: halo, haloSize: haloSize, ball: ball, baseY: y, phase: rand(0, 6.28), spd: rand(0.45, 0.75) });
    return g;
  }

  buildLantern(1.74, 3.72, -2.42, 0.22);
  buildLantern(-3.32, 3.18, -2.55, 0.18);
  buildLantern(2.82, 3.86, -3.86, 0.2);
  buildLantern(-1.62, LOFT.y + 0.62, -2.9, 0.16);

  /* =======================================================================
     19. 向日葵盆（花道具）+ 角落小物
     ======================================================================= */
  var vase;
  (function buildBigSunflower() {
    var g = buildSunflower(1.75);
    g.position.set(3.05, 0, -2.3);
    g.rotation.y = -0.35;
    room.add(g);
    vase = g;

    var g2 = buildSunflower(1.05);
    g2.position.set(5.82, 0, -2.15);
    g2.rotation.y = -1.05;
    room.add(g2);
  })();

  (function buildProps() {
    // 沙发边的书堆
    var colors = [M.bookRed, M.bookGreen, M.bookBlue, M.cream];
    for (var i = 0; i < 4; i++) {
      var b = softBox(0.42 - i * 0.02, 0.05, 0.3, 0.008, 0.01, colors[i % 4]);
      b.position.set(-2.66, 0.03 + i * 0.052, -2.5);
      b.rotation.y = 0.2 + i * 0.14;
      room.add(b);
    }

    // 地毯上的向日葵花瓣坐垫改由 makeFlowerCushion() 统一生成（见上方）

    /* 右石墙上的圆菇形搁板 ×2 */
    function roundShelf(y, z) {
      var g = new T.Group();
      var board = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 0.08, 28), M.wood);
      board.position.x = -0.5;
      g.add(board);
      var lip = new T.Mesh(new T.TorusGeometry(0.48, 0.032, 6, 32), M.woodLight);
      lip.rotation.x = Math.PI / 2;
      lip.position.set(-0.5, 0.03, 0);
      g.add(lip);
      // 与墙的连接托板
      var br = new T.Mesh(new T.BoxGeometry(0.26, 0.1, 0.2), M.woodDark);
      br.position.set(-0.06, -0.1, 0);
      g.add(br);
      g.position.set(HW - 0.02, y, z);
      shadowAll(g);
      room.add(g);
    }
    roundShelf(2.5, -2.35);
    roundShelf(3.42, -3.5);

    /* 搁板上的发光水晶球 */
    var orbBase = new T.Mesh(new T.CylinderGeometry(0.11, 0.14, 0.11, 14), M.terracotta);
    orbBase.position.set(HW - 0.55, 2.6, -3.5);
    room.add(orbBase);
    var orb = new T.Mesh(new T.SphereGeometry(0.19, 20, 16), new T.MeshStandardMaterial({
      color: 0xfff6ea, roughness: 0.12, metalness: 0.0,
      emissive: 0xffc98d, emissiveIntensity: 1.4, transparent: true, opacity: 0.95
    }));
    orb.position.set(HW - 0.55, 2.76, -3.5);
    room.add(orb);
    var orbGlow = new T.Sprite(new T.SpriteMaterial({
      map: texGlow, color: 0xffb877, transparent: true, opacity: 0.55,
      blending: T.AdditiveBlending, depthWrite: false
    }));
    orbGlow.scale.setScalar(1.5);
    orbGlow.position.copy(orb.position);
    noRaycast(orbGlow);
    room.add(orbGlow);

    /* 阁楼前的小光球 */
    var orb2 = new T.Mesh(new T.SphereGeometry(0.11, 16, 12), new T.MeshStandardMaterial({
      color: 0xfff0d6, roughness: 0.4, emissive: 0xffbe7a, emissiveIntensity: 1.1
    }));
    orb2.position.set(-2.3, 3.12, -3.25);
    room.add(orb2);
    var orbGlow2 = new T.Sprite(new T.SpriteMaterial({
      map: texGlow, color: 0xffc080, transparent: true, opacity: 0.5,
      blending: T.AdditiveBlending, depthWrite: false
    }));
    orbGlow2.scale.setScalar(0.95);
    orbGlow2.position.copy(orb2.position);
    noRaycast(orbGlow2);
    room.add(orbGlow2);

    // 拖鞋
    [-1, 1].forEach(function (sd) {
      var sl2 = new T.Mesh(new T.SphereGeometry(0.16, 14, 10), M.cushionSoft);
      sl2.scale.set(1.5, 0.42, 0.85);
      sl2.position.set(-2.55, 0.06, -2.95 + sd * 0.2);
      sl2.rotation.y = 0.2 + sd * 0.08;
      sl2.castShadow = true;
      room.add(sl2);
    });

    // 角落植物
    [[5.98, -4.2, 1.1], [-3.62, -3.05, 1.05]].forEach(function (p) {
      var pl = buildMonstera(p[2]);
      pl.position.set(p[0], 0, p[1]);
      pl.rotation.y = rand(-0.5, 0.5);
      room.add(pl);
    });
  })();

  /* =======================================================================
     19b. 主角道具：大橙团抱枕 / 白瓷壶插花 / 姆明玩偶 / 向日葵床
     ======================================================================= */
  (function buildHeroProps() {
    /* ---- 巨大的黄色鸭鸭抱枕（前左角，参考截图里的趴地鸭） ---- */
    (function bigPlush() {
      var g = new T.Group();
      var bodyMat = std(0xf5b041, { roughness: 0.96 });
      var bodyMat2 = std(0xe89a2c, { roughness: 0.96 });
      var beakMat = std(0xe9771f, { roughness: 0.82 });
      var eyeMat = std(0x1d1410, { roughness: 0.55 });

      // 趴着的身体（扁圆）
      var body = new T.Mesh(new T.SphereGeometry(0.95, 30, 22), bodyMat);
      body.scale.set(1.3, 0.68, 1.0);
      body.position.y = 0.7;
      g.add(body);

      // 头部（前伸，露出脸）
      var head = new T.Mesh(new T.SphereGeometry(0.6, 26, 20), bodyMat);
      head.scale.set(1.0, 0.94, 1.0);
      head.position.set(0, 0.9, 0.74);
      g.add(head);

      // 两侧翅膀（略深色、扁圆）
      [-1, 1].forEach(function (sd) {
        var wing = new T.Mesh(new T.SphereGeometry(0.52, 20, 16), bodyMat2);
        wing.scale.set(0.5, 0.6, 1.0);
        wing.position.set(sd * 1.0, 0.58, -0.12);
        wing.rotation.z = sd * 0.16;
        g.add(wing);
      });

      // 橙色的扁喙
      var beak = new T.Mesh(new T.SphereGeometry(0.19, 16, 12), beakMat);
      beak.scale.set(1.6, 0.48, 0.95);
      beak.position.set(0, 0.84, 1.3);
      g.add(beak);
      var beakLip = new T.Mesh(new T.BoxGeometry(0.4, 0.05, 0.16), std(0xc25a12, { roughness: 0.8 }));
      beakLip.position.set(0, 0.79, 1.36);
      beakLip.rotation.x = 0.12;
      g.add(beakLip);

      // 黑色菱形眼睛
      [-1, 1].forEach(function (sd) {
        var eye = new T.Mesh(new T.BoxGeometry(0.15, 0.15, 0.06), eyeMat);
        eye.position.set(sd * 0.3, 1.04, 1.2);
        eye.rotation.z = Math.PI / 4;
        g.add(eye);
        var spark = new T.Mesh(new T.SphereGeometry(0.026, 8, 8), std(0xffffff, { roughness: 0.3 }));
        spark.position.set(sd * 0.26, 1.08, 1.25);
        g.add(spark);
      });

      // 小脚丫
      [-1, 1].forEach(function (sd) {
        var foot = new T.Mesh(new T.SphereGeometry(0.24, 16, 12), beakMat);
        foot.scale.set(1.35, 0.42, 1.15);
        foot.position.set(sd * 0.46, 0.1, 0.92);
        g.add(foot);
      });

      // 小尾巴
      var tail = new T.Mesh(new T.SphereGeometry(0.3, 16, 12), bodyMat2);
      tail.scale.set(0.85, 0.7, 0.7);
      tail.position.set(0, 0.62, -0.92);
      g.add(tail);

      shadowAll(g);
      g.scale.setScalar(0.92);
      g.position.set(-4.82, 0, 3.42);
      g.rotation.y = 0.92;
      room.add(g);
    })();

    /* ---- 白瓷壶插花（梯口矮台上） ---- */
    (function pitcher() {
      var g = new T.Group();
      var bodyProf = [];
      for (var i = 0; i <= 14; i++) {
        var t = i / 14;
        var r = 0.1 + Math.sin(t * Math.PI * 0.92) * 0.16;
        bodyProf.push(new T.Vector2(r, t * 0.42));
      }
      var body = new T.Mesh(new T.LatheGeometry(bodyProf, 24), M.white);
      g.add(body);
      var neck = new T.Mesh(new T.CylinderGeometry(0.11, 0.13, 0.1, 20), M.white);
      neck.position.y = 0.44;
      g.add(neck);
      var handle = new T.Mesh(new T.TorusGeometry(0.1, 0.028, 6, 18, Math.PI * 1.3), M.white);
      handle.position.set(0.2, 0.3, 0);
      handle.rotation.z = -0.5;
      g.add(handle);

      // 花枝
      var cols = [M.petal, M.petalDeep, std(0xb98bd6, { roughness: 0.9 })];
      for (var k = 0; k < 7; k++) {
        var a = rand(0, 6.28);
        var lean = rand(0.08, 0.3);
        var h = rand(0.34, 0.6);
        var stem = new T.Mesh(new T.CylinderGeometry(0.008, 0.01, h, 5), M.leafDark);
        stem.position.set(Math.cos(a) * lean * 0.5, 0.46 + h / 2, Math.sin(a) * lean * 0.5);
        stem.rotation.z = Math.cos(a) * lean * 0.4;
        stem.rotation.x = -Math.sin(a) * lean * 0.4;
        g.add(stem);
        var bud = new T.Mesh(new T.SphereGeometry(0.055, 10, 8), cols[k % 3]);
        bud.scale.set(1, 0.7, 1);
        bud.position.set(Math.cos(a) * lean, 0.46 + h, Math.sin(a) * lean);
        g.add(bud);
      }
      shadowAll(g);
      g.position.set(-4.32, 0.49, 1.55);
      room.add(g);
    })();

    /* ---- 白色姆明玩偶（沙发上） ---- */
    (function moomin() {
      var g = new T.Group();
      var fur = std(0xfdf8ef, { roughness: 0.96 });
      var body = new T.Mesh(new T.SphereGeometry(0.34, 20, 16), fur);
      body.scale.set(0.86, 1.12, 0.8);
      body.position.y = 0.36;
      g.add(body);
      var head = new T.Mesh(new T.SphereGeometry(0.27, 20, 16), fur);
      head.scale.set(0.92, 0.86, 0.9);
      head.position.y = 0.78;
      g.add(head);
      // 耳朵
      [-1, 1].forEach(function (sd) {
        var ear = new T.Mesh(new T.ConeGeometry(0.07, 0.16, 8), fur);
        ear.position.set(sd * 0.1, 0.99, 0);
        g.add(ear);
      });
      // 鼻子
      var nose = new T.Mesh(new T.SphereGeometry(0.09, 12, 10), fur);
      nose.scale.set(0.9, 0.8, 1.2);
      nose.position.set(0, 0.76, 0.24);
      g.add(nose);
      // 眼睛
      [-1, 1].forEach(function (sd) {
        var eye = new T.Mesh(new T.SphereGeometry(0.024, 8, 8), M.dark);
        eye.position.set(sd * 0.09, 0.85, 0.21);
        g.add(eye);
      });
      // 手
      [-1, 1].forEach(function (sd) {
        var arm = new T.Mesh(new T.SphereGeometry(0.1, 12, 10), fur);
        arm.scale.set(0.8, 1, 0.8);
        arm.position.set(sd * 0.3, 0.4, 0.05);
        g.add(arm);
      });
      shadowAll(g);
      g.position.set(-2.16, 0.55, -4.32);
      g.rotation.y = 0.5;
      room.add(g);
    })();

    /* ---- 向日葵床（石拱龛内，靠后墙） ---- */
    (function sunflowerBed() {
      var g = new T.Group();

      // 床架
      var frame = softBox(2.2, 0.34, 2.5, 0.06, 0.12, M.wood);
      frame.position.set(0, 0.2, 0.05);
      g.add(frame);
      // 四只脚
      [[-0.92, -1.1], [0.92, -1.1], [-0.92, 1.2], [0.92, 1.2]].forEach(function (q) {
        var leg = new T.Mesh(new T.CylinderGeometry(0.08, 0.07, 0.1, 8), M.woodDark);
        leg.position.set(q[0], 0.05, q[1]);
        g.add(leg);
      });

      // 大床垫（横躺的圆柱，做出蓬松被子感）
      var mattress = new T.Mesh(new T.CylinderGeometry(0.92, 0.92, 2.35, 30), M.cushionSoft);
      mattress.rotation.x = Math.PI / 2;
      mattress.scale.set(1.12, 1, 0.92);
      mattress.position.set(0, 0.86, 0.1);
      mattress.castShadow = true;
      g.add(mattress);

      // 被面褶皱：几条浅色圆条
      for (var i = 0; i < 3; i++) {
        var roll = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 2.0, 12), M.cushionPale);
        roll.rotation.x = Math.PI / 2;
        roll.position.set(-0.5 + i * 0.5, 1.62, 0.15);
        g.add(roll);
      }

      // 床头的向日葵
      var head = new T.Group();
      var disc = new T.Mesh(new T.CylinderGeometry(0.56, 0.56, 0.14, 28), M.seed);
      disc.rotation.x = Math.PI / 2;
      head.add(disc);
      for (var p = 0; p < 16; p++) {
        var pa = p / 16 * Math.PI * 2;
        var petal = new T.Mesh(new T.SphereGeometry(0.4, 12, 10), p % 2 ? M.petal : M.petalDeep);
        petal.scale.set(0.34, 0.5, 0.16);
        petal.position.set(Math.cos(pa) * 0.72, Math.sin(pa) * 0.72, 0);
        petal.rotation.z = pa - Math.PI / 2;
        head.add(petal);
      }
      // 花盘内圈刻纹
      var ring = new T.Mesh(new T.TorusGeometry(0.4, 0.025, 6, 30), M.petalDeep);
      head.add(ring);
      head.position.set(0, 1.62, -1.02);
      g.add(head);

      // 枕头
      var pil = softBox(0.9, 0.3, 0.4, 0.06, 0.14, M.cushionPale);
      pil.position.set(0, 1.72, -0.78);
      pil.rotation.y = 0.08;
      g.add(pil);

      shadowAll(g);
      g.position.set(4.5, 0, -3.72);
      room.add(g);
    })();
  })();

  /* 接触阴影 */
  var texAO = canvasTex(256, 256, function (ctx, w, h) {
    var g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(56,30,14,0.55)');
    g.addColorStop(0.4, 'rgba(56,30,14,0.24)');
    g.addColorStop(0.72, 'rgba(56,30,14,0.07)');
    g.addColorStop(1, 'rgba(50,24,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { clamp: true });

  /* 柔光 */
  var texGlow = canvasTex(128, 128, function (ctx, w, h) {
    var g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.22, 'rgba(255,240,215,0.72)');
    g.addColorStop(0.5, 'rgba(255,214,165,0.2)');
    g.addColorStop(1, 'rgba(255,200,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { clamp: true });

  /* 星光 */
  var texStar = canvasTex(128, 128, function (ctx, w, h) {
    var c = w / 2;
    var g = ctx.createRadialGradient(c, c, 0, c, c, c * 0.45);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,235,205,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,250,240,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c, 8); ctx.lineTo(c, h - 8);
    ctx.moveTo(8, c); ctx.lineTo(w - 8, c);
    ctx.stroke();
  }, { clamp: true });

  /* =======================================================================
     2b. 梵高风挂画贴图
     ======================================================================= */
  var artCache = {};
  function artTex(kind) {
    if (artCache[kind]) return artCache[kind];
    var t = canvasTex(400, 300, function (ctx, w, h) { drawArt(ctx, w, h, kind); }, { clamp: true });
    artCache[kind] = t;
    return t;
  }

  function drawArt(ctx, w, h, kind) {
    function bgv(c1, c2) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    function bgh(c1, c2) {
      var g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    function strokes(n, colFn, lMin, lMax, tMin, tMax) {
      ctx.lineCap = 'round';
      for (var i = 0; i < n; i++) {
        ctx.strokeStyle = colFn();
        ctx.lineWidth = rand(tMin, tMax);
        var x = rand(0, w), y = rand(0, h);
        var a = rand(0, 6.283), l = rand(lMin, lMax);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        ctx.stroke();
      }
    }
    function hill(y, col, amp) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, y);
      for (var x = 0; x <= w; x += 24) {
        ctx.lineTo(x, y + Math.sin(x * 0.02) * amp);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }

    switch (kind) {
      case 'starry':
        bgv('#16223f', '#3a4d78');
        // 漩涡星云
        for (var s = 0; s < 5; s++) {
          var cx = rand(w * 0.15, w * 0.85), cy = rand(h * 0.15, h * 0.55);
          var rr0 = rand(20, 50);
          for (var a = 0; a < 70; a++) {
            var t2 = a / 70, ang = t2 * 6.283 * 3.2, rr = t2 * rr0;
            ctx.strokeStyle = 'rgba(' + randInt(190, 225) + ',' + randInt(205, 232) + ',' + randInt(235, 255) + ',' + rand(0.25, 0.7).toFixed(2) + ')';
            ctx.lineWidth = rand(1.2, 3.2);
            ctx.beginPath(); ctx.arc(cx, cy, rr, ang, ang + 0.7); ctx.stroke();
          }
        }
        // 星（带光晕）
        for (var i = 0; i < 46; i++) {
          var sx2 = rand(0, w), sy2 = rand(0, h * 0.6), sr = rand(1, 3.4);
          ctx.strokeStyle = 'rgba(255,240,180,0.45)'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(sx2, sy2, sr + rand(2, 4), 0, 6.283); ctx.stroke();
          ctx.fillStyle = 'rgba(255,248,214,' + rand(0.7, 1).toFixed(2) + ')';
          ctx.beginPath(); ctx.arc(sx2, sy2, sr, 0, 6.283); ctx.fill();
        }
        // 月亮
        ctx.fillStyle = 'rgba(255,238,150,0.35)';
        ctx.beginPath(); ctx.arc(w * 0.74, h * 0.2, 40, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#f9e07e';
        ctx.beginPath(); ctx.arc(w * 0.74, h * 0.2, 27, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#fff3c4';
        ctx.beginPath(); ctx.arc(w * 0.72, h * 0.185, 12, 0, 6.283); ctx.fill();
        // 远山 + 村庄（亮窗）
        hill(h * 0.8, '#232d4a', 6);
        for (var v = 0; v < 9; v++) {
          var vx = rand(w * 0.12, w * 0.92), vw = rand(6, 13), vhh = rand(9, 20);
          ctx.fillStyle = '#1a2338';
          ctx.fillRect(vx, h * 0.74 + rand(-5, 8), vw, vhh);
          ctx.fillStyle = 'rgba(255,206,120,0.9)'; ctx.fillRect(vx + 2, h * 0.76, 2.5, 2.5);
        }
        // 丝柏（深色，带纹理）
        ctx.fillStyle = '#0f1f2c';
        ctx.beginPath();
        ctx.moveTo(w * 0.24, h); ctx.quadraticCurveTo(w * 0.15, h * 0.55, w * 0.24, h * 0.22);
        ctx.quadraticCurveTo(w * 0.33, h * 0.55, w * 0.31, h); ctx.closePath(); ctx.fill();
        for (var cyp = 0; cyp < 60; cyp++) {
          ctx.strokeStyle = 'rgba(40,70,60,0.5)'; ctx.lineWidth = 1;
          var cxy = rand(h * 0.25, h);
          ctx.beginPath(); ctx.moveTo(w * 0.24 + rand(-6, 6), cxy); ctx.lineTo(w * 0.24 + rand(-4, 8), cxy + 10); ctx.stroke();
        }
        break;

      case 'wheat':
        bgv('#9fc0d8', '#d8c88a');
        ctx.fillStyle = '#f2d06a';
        ctx.beginPath(); ctx.arc(w * 0.7, h * 0.28, 34, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#3a4a2a';
        ctx.beginPath();
        ctx.moveTo(w * 0.2, h); ctx.quadraticCurveTo(w * 0.13, h * 0.42, w * 0.2, h * 0.18);
        ctx.quadraticCurveTo(w * 0.29, h * 0.42, w * 0.27, h); ctx.fill();
        strokes(300, function () {
          return 'rgba(' + randInt(210, 255) + ',' + randInt(150, 200) + ',' + randInt(50, 110) + ',0.72)';
        }, 8, 22, 2, 4);
        break;

      case 'bedroom':
        bgv('#cfd6c2', '#e6d9a8');
        // 墙
        ctx.fillStyle = '#d9cfa0'; ctx.fillRect(0, 0, w, h * 0.62);
        ctx.fillStyle = '#c9b98a'; ctx.fillRect(0, h * 0.62, w, h * 0.38);
        // 窗
        ctx.fillStyle = '#8fb0c0'; ctx.fillRect(w * 0.12, h * 0.18, w * 0.2, h * 0.3);
        ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 4;
        ctx.strokeRect(w * 0.12, h * 0.18, w * 0.2, h * 0.3);
        // 床
        ctx.fillStyle = '#c98a3a'; ctx.fillRect(w * 0.4, h * 0.48, w * 0.5, h * 0.34);
        ctx.fillStyle = '#e2b56a'; ctx.fillRect(w * 0.42, h * 0.52, w * 0.46, h * 0.14);
        ctx.fillStyle = '#a86a2a'; ctx.fillRect(w * 0.4, h * 0.78, w * 0.5, h * 0.08);
        // 椅
        ctx.fillStyle = '#8a5a2a'; ctx.fillRect(w * 0.3, h * 0.6, w * 0.09, h * 0.24);
        ctx.fillStyle = '#c58a3a'; ctx.fillRect(w * 0.28, h * 0.56, w * 0.13, h * 0.08);
        strokes(90, function () { return 'rgba(120,90,50,0.12)'; }, 4, 12, 1, 2);
        break;

      case 'portrait':
        bgh('#3f6a70', '#5a8a80');
        for (var p = 0; p < 60; p++) {
          ctx.strokeStyle = 'rgba(' + randInt(60, 110) + ',' + randInt(110, 150) + ',' + randInt(120, 160) + ',0.5)';
          ctx.lineWidth = rand(4, 9);
          var px = rand(0, w), py = rand(0, h), pa = rand(0, 6.28);
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(pa) * 16, py + Math.sin(pa) * 16); ctx.stroke();
        }
        // 脸
        ctx.fillStyle = '#e0b088';
        ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.52, w * 0.2, h * 0.26, 0, 0, 6.283); ctx.fill();
        // 帽子
        ctx.fillStyle = '#c7a24e';
        ctx.beginPath(); ctx.moveTo(w * 0.28, h * 0.32); ctx.lineTo(w * 0.72, h * 0.32); ctx.lineTo(w * 0.66, h * 0.16); ctx.lineTo(w * 0.34, h * 0.16); ctx.closePath(); ctx.fill();
        // 胡子
        ctx.fillStyle = '#b06a3a';
        ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.72, w * 0.13, h * 0.09, 0, 0, 6.283); ctx.fill();
        // 眼
        ctx.fillStyle = '#33241a';
        ctx.beginPath(); ctx.arc(w * 0.44, h * 0.5, 3.4, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.arc(w * 0.56, h * 0.5, 3.4, 0, 6.283); ctx.fill();
        break;

      case 'blossom':
        bgv('#4f8079', '#7fa699');
        strokes(140, function () { return 'rgba(120,150,140,0.16)'; }, 6, 16, 2, 4);
        // 枝
        ctx.strokeStyle = '#4a3220'; ctx.lineWidth = 7; ctx.lineCap = 'round';
        function branch(x0, y0, x1, y1) {
          ctx.beginPath(); ctx.moveTo(x0, y0);
          ctx.quadraticCurveTo((x0 + x1) / 2 + rand(-20, 20), (y0 + y1) / 2, x1, y1);
          ctx.stroke();
        }
        branch(w * 0.2, h, w * 0.5, h * 0.42);
        branch(w * 0.5, h * 0.42, w * 0.82, h * 0.25);
        branch(w * 0.5, h * 0.42, w * 0.6, h * 0.1);
        branch(w * 0.5, h * 0.42, w * 0.3, h * 0.22);
        // 细枝
        ctx.strokeStyle = '#5a3e28'; ctx.lineWidth = 3;
        for (var tw = 0; tw < 10; tw++) {
          var bx = rand(w * 0.2, w * 0.85), by = rand(h * 0.12, h * 0.55);
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + rand(-30, 30), by + rand(-24, 24)); ctx.stroke();
        }
        // 花（白 + 淡粉）
        for (var fl = 0; fl < 54; fl++) {
          var fx = rand(w * 0.1, w * 0.94), fy = rand(h * 0.04, h * 0.62);
          var pinkish = fl % 4 === 0;
          ctx.fillStyle = pinkish ? 'rgba(252,214,222,0.95)' : 'rgba(255,250,244,' + rand(0.8, 1).toFixed(2) + ')';
          var pr = rand(3.5, 6);
          for (var pt = 0; pt < 5; pt++) {
            var fa = pt / 5 * 6.283;
            ctx.beginPath(); ctx.ellipse(fx + Math.cos(fa) * pr * 0.9, fy + Math.sin(fa) * pr * 0.9, pr * 0.75, pr * 0.5, fa, 0, 6.283); ctx.fill();
          }
          ctx.fillStyle = '#d9a63e';
          ctx.beginPath(); ctx.arc(fx, fy, 2, 0, 6.283); ctx.fill();
        }
        break;

      case 'sunflower':
        bgv('#f6d84e', '#e6ab30');
        strokes(160, function () { return 'rgba(230,180,60,0.16)'; }, 8, 22, 2, 5);
        // 花瓶
        ctx.fillStyle = '#c47c33';
        ctx.beginPath();
        ctx.moveTo(w * 0.4, h * 0.6); ctx.quadraticCurveTo(w * 0.34, h * 0.78, w * 0.42, h * 0.94);
        ctx.lineTo(w * 0.58, h * 0.94); ctx.quadraticCurveTo(w * 0.66, h * 0.78, w * 0.6, h * 0.6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#a9652a'; ctx.fillRect(w * 0.4, h * 0.6, w * 0.2, h * 0.05);
        // 花（高低错落）
        var blooms = [
          [0.34, 0.41, 15], [0.5, 0.30, 17], [0.66, 0.4, 14], [0.44, 0.24, 12],
          [0.58, 0.22, 13], [0.3, 0.55, 11], [0.7, 0.56, 11]
        ];
        blooms.forEach(function (B) {
          var sx = w * B[0], sy = h * B[1], rad = B[2];
          ctx.strokeStyle = '#5f6f2e'; ctx.lineWidth = 3; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + 8, h * 0.48, w * 0.5, h * 0.62); ctx.stroke();
          for (var layer = 0; layer < 2; layer++) {
            ctx.fillStyle = layer ? '#f0a02c' : '#d97e1e';
            var r_r = rad * (layer ? 1 : 0.82), off = layer ? 0 : 0.26;
            for (var pe = 0; pe < 14; pe++) {
              var pea = pe / 14 * 6.283 + off;
              ctx.beginPath();
              ctx.ellipse(sx + Math.cos(pea) * r_r, sy + Math.sin(pea) * r_r, r_r * 0.46, r_r * 0.24, pea, 0, 6.283);
              ctx.fill();
            }
          }
          ctx.fillStyle = '#6a3f1c';
          ctx.beginPath(); ctx.arc(sx, sy, rad * 0.6, 0, 6.283); ctx.fill();
          ctx.fillStyle = '#8a5a26';
          for (var sd = 0; sd < 18; sd++) {
            var sa = sd / 18 * 6.283;
            ctx.beginPath(); ctx.arc(sx + Math.cos(sa) * rad * 0.42, sy + Math.sin(sa) * rad * 0.42, 1.1, 0, 6.283); ctx.fill();
          }
        });
        break;

      case 'windmill':
        bgv('#a8c4d8', '#e0d2a0');
        hill(h * 0.66, '#7a8a4a', 10);
        hill(h * 0.8, '#5f7438', 8);
        // 风车
        ctx.fillStyle = '#b06a3a';
        ctx.beginPath(); ctx.moveTo(w * 0.62, h * 0.68); ctx.lineTo(w * 0.66, h * 0.36); ctx.lineTo(w * 0.7, h * 0.68); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8a4a26';
        for (var bl = 0; bl < 4; bl++) {
          var ba = bl / 4 * 6.283 + 0.4;
          ctx.save();
          ctx.translate(w * 0.66, h * 0.34);
          ctx.rotate(ba);
          ctx.fillRect(-2, 0, 4, h * 0.16);
          ctx.restore();
        }
        strokes(80, function () { return 'rgba(90,120,60,0.16)'; }, 6, 16, 2, 3);
        break;

      case 'landscape':
        bgv('#9fc0d8', '#e6d8a8');
        hill(h * 0.6, '#7a8f52', 12);
        hill(h * 0.78, '#5c7038', 9);
        ctx.fillStyle = '#4a5a2a';
        ctx.beginPath(); ctx.arc(w * 0.24, h * 0.66, 16, 0, 6.283); ctx.fill();
        ctx.fillRect(w * 0.23, h * 0.66, 6, h * 0.2);
        ctx.fillStyle = '#f2e08a';
        ctx.beginPath(); ctx.arc(w * 0.76, h * 0.24, 22, 0, 6.283); ctx.fill();
        strokes(70, function () { return 'rgba(80,110,55,0.14)'; }, 6, 16, 2, 3);
        break;

      case 'hillside':
        bgv('#cdd8b0', '#9ab070');
        hill(h * 0.55, '#7f9a4e', 14);
        hill(h * 0.72, '#62803a', 10);
        ctx.fillStyle = '#4e6428';
        ctx.beginPath(); ctx.arc(w * 0.7, h * 0.5, 20, 0, 6.283); ctx.fill();
        ctx.fillRect(w * 0.69, h * 0.5, 8, h * 0.26);
        strokes(110, function () { return 'rgba(70,95,40,0.16)'; }, 6, 16, 2, 4);
        break;

      case 'cafe':
        bgv('#2e3a5a', '#6a5a6a');
        // 星空
        for (var st = 0; st < 30; st++) {
          ctx.fillStyle = 'rgba(255,240,200,' + rand(0.3, 0.9).toFixed(2) + ')';
          ctx.beginPath(); ctx.arc(rand(0, w), rand(0, h * 0.4), rand(0.8, 2.4), 0, 6.283); ctx.fill();
        }
        // 雨棚
        ctx.fillStyle = '#e0b03a'; ctx.fillRect(0, h * 0.4, w, h * 0.14);
        // 墙面
        ctx.fillStyle = '#c98a3a'; ctx.fillRect(0, h * 0.54, w, h * 0.46);
        // 窗
        ctx.fillStyle = '#f2d06a'; ctx.fillRect(w * 0.1, h * 0.58, w * 0.2, h * 0.2);
        // 桌椅
        ctx.fillStyle = '#5a3a22';
        for (var tb = 0; tb < 3; tb++) {
          var tx = w * 0.3 + tb * w * 0.22;
          ctx.fillRect(tx, h * 0.72, w * 0.1, h * 0.05);
          ctx.fillRect(tx + w * 0.04, h * 0.77, 3, h * 0.1);
        }
        break;
    }

    // 统一色罩：让所有挂画带一点暖橙调
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(240,170,90,0.045)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  /* =======================================================================
     3. 渲染器 / 场景 / 相机
     ======================================================================= */
  /* =======================================================================
     20. 星空 / 尘埃
     ======================================================================= */
  var starField, bigStars = [];

  (function buildStars() {
    var n = 900;
    var pos = new Float32Array(n * 3);
    var col = new Float32Array(n * 3);
    var c = new T.Color();
    for (var i = 0; i < n; i++) {
      var u = Math.random() * 2 - 1;
      var theta = Math.random() * Math.PI * 2;
      var r = rand(66, 110);
      var s = Math.sqrt(1 - u * u);
      pos[i * 3] = r * s * Math.cos(theta);
      pos[i * 3 + 1] = r * u * 0.75 + 10;
      pos[i * 3 + 2] = r * s * Math.sin(theta);
      var warm = Math.random();
      c.setHSL(warm > 0.7 ? 0.08 : 0.6, warm > 0.7 ? 0.45 : 0.2, rand(0.62, 0.95));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    starField = new T.Points(geo, new T.PointsMaterial({
      map: texStar, size: 1.1, sizeAttenuation: true, vertexColors: true,
      transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending
    }));
    noRaycast(starField);
    scene.add(starField);

    for (var j = 0; j < 14; j++) {
      var sp = new T.Sprite(new T.SpriteMaterial({
        map: texStar, color: Math.random() > 0.7 ? 0xffd9a0 : 0xffe6c8,
        transparent: true, opacity: rand(0.3, 0.75),
        blending: T.AdditiveBlending, depthWrite: false
      }));
      var u2 = Math.random() * 0.6 + 0.15;
      var th2 = rand(0, 6.28);
      var r2 = rand(60, 80);
      var s2 = Math.sqrt(1 - u2 * u2);
      sp.position.set(r2 * s2 * Math.cos(th2), r2 * u2 * 0.8 + 12, r2 * s2 * Math.sin(th2));
      sp.scale.setScalar(rand(1.4, 3.4));
      sp.userData.tw = rand(0.5, 1.6);
      noRaycast(sp);
      scene.add(sp);
      bigStars.push(sp);
    }
  })();

  var dust;
  (function buildDust() {
    var n = 130;
    var pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      pos[i * 3] = rand(-HW + 0.3, HW - 0.3);
      pos[i * 3 + 1] = rand(0.3, 5.2);
      pos[i * 3 + 2] = rand(-HD + 0.3, HD - 0.3);
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    dust = new T.Points(geo, new T.PointsMaterial({
      map: texGlow, color: 0xffd7ac, size: 0.075, sizeAttenuation: true,
      transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false
    }));
    noRaycast(dust);
    room.add(dust);
  })();

  /* =======================================================================
     21. 可交互物件注册
     ======================================================================= */

  function register(obj, id, extra) {
    var cfg = null;
    for (var i = 0; i < CONFIG.items.length; i++) {
      if (CONFIG.items[i].id === id) { cfg = CONFIG.items[i]; break; }
    }
    if (!cfg) return null;

    obj.updateWorldMatrix(true, false);
    var wp = new T.Vector3();
    var wq = new T.Quaternion();
    obj.getWorldPosition(wp);
    obj.getWorldQuaternion(wq);

    var wrap = new T.Group();
    wrap.position.copy(wp);
    wrap.quaternion.copy(wq);
    room.add(wrap);
    wrap.add(obj);
    obj.position.set(0, 0, 0);
    obj.quaternion.identity();

    wrap.userData = {
      id: id, name: cfg.name, text: cfg.text, found: false, hover: 1,
      react: extra && extra.react ? extra.react : null,
      giftPage: !!(extra && extra.giftPage),
      letterPage: !!(extra && extra.letterPage),
      hint: extra && extra.hint ? extra.hint : null
    };
    pickables.push(wrap);
    itemById[id] = wrap;
    return wrap;
  }

  /* 仅查看详情、不计入进度 / 不触发终章的物件（如倚墙画板） */
  function registerInfo(obj, name, text, react) {
    obj.updateWorldMatrix(true, false);
    var wp = new T.Vector3();
    var wq = new T.Quaternion();
    obj.getWorldPosition(wp);
    obj.getWorldQuaternion(wq);

    var wrap = new T.Group();
    wrap.position.copy(wp);
    wrap.quaternion.copy(wq);
    room.add(wrap);
    wrap.add(obj);
    obj.position.set(0, 0, 0);
    obj.quaternion.identity();

    wrap.userData = { id: '__info', name: name, text: text, found: false, hover: 1, infoOnly: true, react: react || null };
    pickables.push(wrap);
    return wrap;
  }

  /* 画作（立着的画板 / 墙上的画）：点击进入详情页，不计入 8 项进度、不弹小卡片 */
  function registerArt(obj, kind) {
    obj.updateWorldMatrix(true, false);
    var wp = new T.Vector3();
    var wq = new T.Quaternion();
    obj.getWorldPosition(wp);
    obj.getWorldQuaternion(wq);

    var wrap = new T.Group();
    wrap.position.copy(wp);
    wrap.quaternion.copy(wq);
    room.add(wrap);
    wrap.add(obj);
    obj.position.set(0, 0, 0);
    obj.quaternion.identity();

    var info = ART_INFO[kind] || { title: '画作', ar: 1.35 };
    wrap.userData = {
      id: '__art', name: info.title, artKind: kind, artDetail: true,
      found: false, hover: 1, hint: '点我看详情'
    };
    pickables.push(wrap);

    /* 记录去重题材顺序，供详情页上一张/下一张导航（仅在首次出现时入列） */
    if (artOrder.indexOf(kind) === -1) artOrder.push(kind);

    return wrap;
  }

  /* 画板：点击打开「和你的约稿」专属作品页（九张配色稿，可放大） */
  function registerCommission(obj, name) {
    obj.updateWorldMatrix(true, false);
    var wp = new T.Vector3();
    var wq = new T.Quaternion();
    obj.getWorldPosition(wp);
    obj.getWorldQuaternion(wq);

    var wrap = new T.Group();
    wrap.position.copy(wp);
    wrap.quaternion.copy(wq);
    room.add(wrap);
    wrap.add(obj);
    obj.position.set(0, 0, 0);
    obj.quaternion.identity();

    wrap.userData = {
      id: '__art', name: name || '画板', commissionPage: true,
      found: false, hover: 1, hint: '点我看约稿'
    };
    pickables.push(wrap);
    return wrap;
  }

  register(sofa, 'sofa');
  register(gramoObj.group, 'gramo', {
    react: function () {
      if (Sound.radioPlaying()) {
        Sound.stopRadio();
        gramoObj.record.userData.spin = 0;
        this.text = '再点一下，<br/>接着把这首听完。';
      } else {
        if (!Sound.on) Sound.enable();          // 确保总音量已开
        Sound.playRadio();
        gramoObj.record.userData.spin = 1;
        tween(gramoObj.horn.rotation, 'x', 0.28, 1.2, 0.1);
        this.text = '唱片转起来了，<br/>今晚的歌，单曲循环。';
      }
    }
  });
  register(cat, 'cat', {
    react: function () { cat.userData.stretch = 1; Sound.purr(); }
  });
  register(giftObj.group, 'gift', {
    giftPage: true,
    react: function () { giftObj.lid.userData.open = 1; Sound.chime(); }
  });
  register(winObj.group, 'window', {
    react: function () {
      winObj.glow.userData.pulse = 1;
      tween(windowLight, 'intensity', 1.6, 1.1, 0.05);
      Sound.chime(true);
    }
  });
  register(tableObj.book, 'book', {
    letterPage: true,
    hint: '点我读信',
    react: function () {
      tween(tableObj.book.rotation, 'y', tableObj.book.rotation.y + 0.55, 0.7, 0.05);
      Sound.page();
    }
  });
  register(vase, 'flower', {
    react: function () { bounce(vase, 0.05); Sound.chime(); }
  });

  (function registerLights() {
    // 命中盒只覆盖灯串本身（窄带），避免挡住其后方的背墙画作
    var hit = new T.Mesh(
      new T.BoxGeometry(ROOM.w * 0.5, 0.3, 0.34),
      new T.MeshBasicMaterial({ visible: false })
    );
    hit.position.set(-1.5, 5.12, -HD + 0.24);
    var g = new T.Group();
    g.add(hit);
    room.add(g);
    register(g, 'lights', {
      react: function () {
        lightStrings.forEach(function (ls) { ls.mat.emissiveIntensity = 3.6; });
        flashLights = 1.5;
        Sound.chime(true);
      }
    });
  })();

  var flashLights = 0;

  var tweens = [];
  function tween(obj, keyName, to, dur, delay) {
    tweens.push({ obj: obj, key: keyName, from: obj[keyName], to: to, t: -(delay || 0), dur: dur || 0.6 });
  }
  function bounce(obj, amt) {
    obj.userData.__bounce = 1;
    obj.userData.__bounceAmt = amt;
  }

  /* =======================================================================
     22. 相机控制
     ======================================================================= */
  var cam = {
    cTheta: 1.58, cPhi: 0.64, cR: 54,
    tTheta: 1.17, tPhi: 1.45, tR: 22,
    minR: 8, maxR: 62,
    minPhi: 0.52, maxPhi: 1.5,
    minTheta: 0.72, maxTheta: 1.62
  };
  var introT = 0;
  var swayT = 0, idleT = 99;

  function fitCamera() {
    var w = pane.clientWidth || 1;
    var h = pane.clientHeight || 1;
    var aspect = w / h;
    camera.aspect = aspect;
    var fov = aspect < 1 ? 42 : (aspect < 1.35 ? 35 : 30);
    camera.fov = fov;
    camera.updateProjectionMatrix();

    var R = CONFIG.camera.fitRadius;
    var vHalf = T.MathUtils.degToRad(fov) / 2;
    var hHalf = Math.atan(Math.tan(vHalf) * aspect);
    var need = Math.max(R / Math.sin(vHalf), R / Math.sin(hHalf)) * 0.94;
    cam.tR = clamp(need, cam.minR, cam.maxR);
    cam.maxR = Math.max(58, cam.tR * 1.8);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
  }

  function applyCamera(dt) {
    var damp = introT < 2.4 ? 2.2 : 9;
    var k = 1 - Math.exp(-damp * dt);
    cam.cTheta += (cam.tTheta - cam.cTheta) * k;
    cam.cPhi += (cam.tPhi - cam.cPhi) * k;
    cam.cR += (cam.tR - cam.cR) * k;

    var swayAmp = (artDetailOpen ? 0 : clamp((idleT - 1.2) / 2.5, 0, 1) * 0.022);
    swayT += dt * 0.22;
    var theta = cam.cTheta + Math.sin(swayT) * swayAmp;
    var phi = cam.cPhi + Math.cos(swayT * 0.7) * swayAmp * 0.3;

    var sinP = Math.sin(phi);
    camera.position.set(
      TARGET.x + cam.cR * sinP * Math.cos(theta),
      TARGET.y + cam.cR * Math.cos(phi),
      TARGET.z + cam.cR * sinP * Math.sin(theta)
    );
    camera.lookAt(TARGET);
  }

  /* 指针 */
  var pointers = new Map();
  var drag = { active: false, moved: 0, lastX: 0, lastY: 0, t0: 0, pinch: 0 };
  var pointerNDC = new T.Vector2(0, 0);
  var tooltipScreen = { x: 0, y: 0 };
  var hasPointer = false;

  function updatePointer(e) {
    var rect = canvas.getBoundingClientRect();
    pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    hasPointer = true;
    tooltipScreen.x = e.clientX - rect.left;
    tooltipScreen.y = e.clientY - rect.top;
  }

  function onPointerDown(e) {
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    audioKick();
    if (pointers.size === 1) {
      drag.active = true; drag.moved = 0;
      drag.lastX = e.clientX; drag.lastY = e.clientY;
      drag.t0 = performance.now();
      canvas.classList.add('grabbing');
    } else if (pointers.size === 2) {
      var arr = Array.from(pointers.values());
      drag.pinch = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
      drag.active = false;
    }
    idleT = 0;
  }

  function onPointerMove(e) {
    updatePointer(e);
    idleT = 0;
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1 && drag.active) {
      var dx = e.clientX - drag.lastX;
      var dy = e.clientY - drag.lastY;
      drag.lastX = e.clientX; drag.lastY = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      cam.tTheta = clamp(cam.tTheta - dx * 0.0062, cam.minTheta, cam.maxTheta);
      cam.tPhi = clamp(cam.tPhi - dy * 0.0048, cam.minPhi, cam.maxPhi);
      cam.cTheta = cam.tTheta; cam.cPhi = cam.tPhi;
      hideTooltip();
    } else if (pointers.size === 2) {
      var arr = Array.from(pointers.values());
      var d = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
      if (drag.pinch > 0) {
        cam.tR = clamp(cam.tR * (drag.pinch / d), cam.minR, cam.maxR);
        cam.cR = cam.tR;
      }
      drag.pinch = d;
    }
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId);
    canvas.classList.remove('grabbing');
    if (pointers.size === 0) {
      var quick = performance.now() - drag.t0 < 420;
      if (drag.active && drag.moved < 7 && quick) tryPick(e);
      drag.active = false; drag.pinch = 0;
    } else if (pointers.size === 1) {
      var rest = Array.from(pointers.values())[0];
      drag.lastX = rest.x; drag.lastY = rest.y; drag.active = true;
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', function () {
    pointers.clear(); drag.active = false; hasPointer = false; hideTooltip();
  });
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    cam.tR = clamp(cam.tR * (1 + e.deltaY * 0.00085), cam.minR, cam.maxR);
    idleT = 0;
  }, { passive: false });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* =======================================================================
     23. 拾取 / 悬停
     ======================================================================= */
  var raycaster = new T.Raycaster();
  var hovered = null;
  var tooltipEl = document.getElementById('tooltip');
  var tooltipName = document.getElementById('tooltip-name');
  var tooltipHintEl = document.getElementById('tooltip-hint');

  function pickAt(ndc) {
    raycaster.setFromCamera(ndc, camera);
    var hits = raycaster.intersectObjects(pickables, true);
    for (var i = 0; i < hits.length; i++) {
      var o = hits[i].object;
      while (o && !o.userData.id) o = o.parent;
      if (o && o.userData.id) return o;
    }
    return null;
  }

  function showTooltip(target) {
    tooltipName.textContent = target.userData.name;
    tooltipHintEl.textContent = target.userData.hint || '点我看看';
    tooltipEl.style.left = tooltipScreen.x + 'px';
    tooltipEl.style.top = tooltipScreen.y + 'px';
    tooltipEl.classList.add('show');
  }
  function hideTooltip() { tooltipEl.classList.remove('show'); }

  function updateHover() {
    if (!hasPointer) return;
    var hit = pickAt(pointerNDC);
    if (hit !== hovered) {
      hovered = hit;
      if (hit) { canvas.classList.add('pointing'); showTooltip(hit); }
      else { canvas.classList.remove('pointing'); hideTooltip(); }
    } else if (hit) {
      tooltipEl.style.left = tooltipScreen.x + 'px';
      tooltipEl.style.top = tooltipScreen.y + 'px';
    }
  }

  function tryPick(e) {
    var rect = canvas.getBoundingClientRect();
    var ndc = new T.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    var hit = pickAt(ndc);
    if (hit) triggerItem(hit);
  }

  /* =======================================================================
     24. 惊喜
     ======================================================================= */
  var found = 0;
  var dotsEl = document.getElementById('dots');
  var countEl = document.getElementById('count');
  var toastEl = document.getElementById('toast');
  var toastName = document.getElementById('toast-name');
  var toastText = document.getElementById('toast-text');
  var toastTimer = null;

  CONFIG.items.forEach(function () { dotsEl.appendChild(document.createElement('i')); });

  function updateProgress() {
    var arr = dotsEl.children;
    for (var i = 0; i < arr.length; i++) arr[i].classList.toggle('on', i < found);
    countEl.textContent = found + ' / ' + CONFIG.items.length;
  }
  updateProgress();

  function showToast(name, text) {
    toastName.textContent = name;
    toastText.innerHTML = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 5200);
  }

  /* =======================================================================
     24b. 画作详情页（点击墙上的画 / 立着的画板进入）
     ======================================================================= */
  var artDetailEl = document.getElementById('art-detail');
  var artCanvas = document.getElementById('art-detail-canvas');
  var artTitleEl = document.getElementById('art-detail-title');
  var artSeriesEl = document.getElementById('art-detail-series');
  var artDescEl = document.getElementById('art-detail-desc');
  var artCounterEl = document.getElementById('art-detail-counter');
  var artPrevBtn = document.getElementById('art-detail-prev');
  var artNextBtn = document.getElementById('art-detail-next');
  var artDetailOpen = false;
  var artCurrentIndex = -1;
  var artThumbsEl = document.getElementById('art-detail-thumbs');
  var artThumbsBuilt = false;

  function buildArtThumbs() {
    if (artThumbsBuilt || !artThumbsEl) return;
    artOrder.forEach(function (kind, i) {
      var info = ART_INFO[kind] || { title: kind, ar: 1.35 };
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'art-thumb';
      cell.setAttribute('role', 'option');
      cell.dataset.index = i;
      var tw = 92, th = Math.round(tw / (info.ar || 1.35));
      var c = document.createElement('canvas');
      c.width = tw; c.height = th;
      c.className = 'art-thumb-canvas';
      var ctx = c.getContext('2d');
      try { drawArt(ctx, tw, th, kind); } catch (e) { /* 忽略绘制异常 */ }
      var label = document.createElement('span');
      label.className = 'art-thumb-label';
      label.textContent = info.title;
      cell.appendChild(c);
      cell.appendChild(label);
      cell.addEventListener('click', function (e) {
        e.stopPropagation();
        artRenderAt(i);
      });
      artThumbsEl.appendChild(cell);
    });
    artThumbsBuilt = true;
  }

  function markArtThumb() {
    if (!artThumbsEl) return;
    var cells = artThumbsEl.children;
    for (var i = 0; i < cells.length; i++) {
      var active = (i === artCurrentIndex);
      cells[i].classList.toggle('active', active);
      if (active) {
        // 滚动到可视区域（居中）
        cells[i].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }

  function artRenderAt(index) {
    if (!artOrder.length) return;
    index = (index + artOrder.length) % artOrder.length;   // 循环浏览
    artCurrentIndex = index;
    var kind = artOrder[index];
    var info = ART_INFO[kind] || { title: '画作', series: '', desc: '', ar: 1.35 };
    var Hpx = 640, Wpx = Math.round(Hpx * info.ar);
    artCanvas.width = Wpx;
    artCanvas.height = Hpx;
    var ctx = artCanvas.getContext('2d');
    ctx.clearRect(0, 0, Wpx, Hpx);
    try { drawArt(ctx, Wpx, Hpx, kind); } catch (e) { /* 忽略绘制异常 */ }

    artTitleEl.textContent = info.title;
    artSeriesEl.textContent = info.series ? '· ' + info.series + ' ·' : '';
    artDescEl.textContent = info.desc;
    if (artCounterEl) artCounterEl.textContent = '第 ' + (index + 1) + ' / ' + artOrder.length + ' 幅';
    markArtThumb();
    if (Sound.on) Sound.page();
  }

  function openArtDetail(kind) {
    var index = artOrder.indexOf(kind);
    if (index === -1) { artOrder.push(kind); index = artOrder.length - 1; }
    buildArtThumbs();
    artRenderAt(index);

    artDetailEl.classList.add('show');
    artDetailEl.setAttribute('aria-hidden', 'false');
    artDetailOpen = true;
    hideTooltip();
    hovered = null;
  }

  function closeArtDetail() {
    artDetailEl.classList.remove('show');
    artDetailEl.setAttribute('aria-hidden', 'true');
    artDetailOpen = false;
  }

  if (artDetailEl) {
    artDetailEl.addEventListener('click', function (e) {
      if (e.target === artDetailEl || e.target.classList.contains('art-detail-backdrop') ||
          e.target.id === 'art-detail-close') closeArtDetail();
    });
    if (artPrevBtn) artPrevBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      artRenderAt(artCurrentIndex - 1);
    });
    if (artNextBtn) artNextBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      artRenderAt(artCurrentIndex + 1);
    });
    document.addEventListener('keydown', function (e) {
      if (!artDetailOpen) return;
      if (e.key === 'Escape') closeArtDetail();
      else if (e.key === 'ArrowLeft') artRenderAt(artCurrentIndex - 1);
      else if (e.key === 'ArrowRight') artRenderAt(artCurrentIndex + 1);
    });
  }

  /* -----------------------------------------------------------------------
     24c. 「和你的约稿」专属作品页（九张配色稿，可放大观看）
     ======================================================================= */
  var COMMISSION_WORKS = [
    { f: 'g1', name: '苔绿',   note: '清晨六点的林子' },
    { f: 'g2', name: '新绿',   note: '正午的日头' },
    { f: 'g3', name: '雾绿',   note: '要下雨之前' },
    { f: 'w4', name: '秋橘',   note: '十月的傍晚' },
    { f: 'w5', name: '蓝调',   note: '天还没黑透' },
    { f: 'w6', name: '樱粉',   note: '四月的一场风' },
    { f: 'n7', name: '晴空',   note: '云刚散开' },
    { f: 'n8', name: '云隙光', note: '光从叶缝漏下来' },
    { f: 'n9', name: '夜光',   note: '整片林子都亮了' }
  ];

  var commissionEl = document.getElementById('commission');
  var commissionGrid = document.getElementById('commission-grid');
  var commissionZoom = document.getElementById('commission-zoom');
  var commissionZoomImg = document.getElementById('commission-zoom-img');
  var commissionZoomCap = document.getElementById('commission-zoom-cap');
  var commissionBuilt = false;

  function buildCommissionGrid() {
    if (commissionBuilt || !commissionGrid) return;
    commissionGrid.innerHTML = '';
    COMMISSION_WORKS.forEach(function (w) {
      var src = 'commission/' + w.f + '.jpg';
      var capText = w.name + ' · ' + w.note;
      var cell = document.createElement('div');
      cell.className = 'commission-cell';
      cell.setAttribute('role', 'button');
      cell.setAttribute('tabindex', '0');
      cell.setAttribute('aria-label', capText);
      cell.setAttribute('data-src', src);
      cell.setAttribute('data-cap', capText);
      var img = document.createElement('img');
      img.src = src;
      img.alt = capText;
      img.loading = 'lazy';
      var cap = document.createElement('div');
      cap.className = 'cap';
      cap.innerHTML = w.name + '<small>' + w.note + '</small>';
      cell.appendChild(img);
      cell.appendChild(cap);
      commissionGrid.appendChild(cell);
    });
    commissionBuilt = true;
  }

  function zoomOpen() { return !!(commissionZoom && commissionZoom.classList.contains('show')); }
  function openZoom(src, cap) {
    if (!commissionZoom) return;
    commissionZoomImg.src = src;
    commissionZoomImg.alt = cap || '';
    commissionZoomCap.textContent = cap || '';
    commissionZoom.classList.add('show');
    commissionZoom.setAttribute('aria-hidden', 'false');
  }
  function closeZoom() {
    if (!commissionZoom) return;
    commissionZoom.classList.remove('show');
    commissionZoom.setAttribute('aria-hidden', 'true');
  }

  function openCommission() {
    if (!commissionEl) return;
    buildCommissionGrid();
    if (artDetailOpen) closeArtDetail();
    commissionEl.classList.add('show');
    commissionEl.setAttribute('aria-hidden', 'false');
    hideTooltip();
    hovered = null;
    if (Sound.on) Sound.page();
  }
  function closeCommission() {
    if (!commissionEl) return;
    closeZoom();
    commissionEl.classList.remove('show');
    commissionEl.setAttribute('aria-hidden', 'true');
  }

  if (commissionEl) {
    commissionEl.addEventListener('click', function (e) {
      if (e.target === commissionEl || e.target.classList.contains('commission-backdrop') ||
          e.target.id === 'commission-close') closeCommission();
    });
    if (commissionGrid) {
      commissionGrid.addEventListener('click', function (e) {
        var cell = e.target.closest ? e.target.closest('.commission-cell') : null;
        if (cell) openZoom(cell.getAttribute('data-src'), cell.getAttribute('data-cap'));
      });
      commissionGrid.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var cell = e.target.closest ? e.target.closest('.commission-cell') : null;
        if (cell) { e.preventDefault(); openZoom(cell.getAttribute('data-src'), cell.getAttribute('data-cap')); }
      });
    }
    if (commissionZoom) {
      commissionZoom.addEventListener('click', function () { closeZoom(); });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (zoomOpen()) { closeZoom(); return; }
      if (commissionEl.classList.contains('show')) closeCommission();
    });
  }

  /* -----------------------------------------------------------------------
     24d. 「礼物盒」作品集（十三张约稿卡面，瀑布流相册 + 放大翻页）
     ======================================================================= */
  var GIFT_WORKS = [
    { f: '1',  name: '独钓寒江雪', note: '枝条新日 · 冬 × 许愿' },
    { f: '2',  name: '纸帐梅花',   note: '休惊他三春清梦' },
    { f: '3',  name: '七夕限定',   note: '笼中花与少年' },
    { f: '4',  name: '以爱为名',   note: '蓝调小提琴 · 电竞周冠' },
    { f: '5',  name: '逃逸水',     note: '掌心相扣 · 素雪限定' },
    { f: '6',  name: '真我永存',   note: '限定艺术展 · 2026/1002' },
    { f: '7',  name: '以爱寻影',   note: '雾山影电竞限定' },
    { f: '8',  name: '雾绕空山',   note: 'Fog Surrounds the Mountain' },
    { f: '9',  name: '艺术故事',   note: '街灯与窗 · 黑胶夜' },
    { f: '10', name: '你',         note: '终之下，我站起来' },
    { f: '11', name: '如果时间只是人为停止', note: 'if Time is only artificially stopped' },
    { f: '12', name: '限定发行',   note: '素雪 club 书行 · 十月刊' },
    { f: '13', name: 'TOWARDS LIMITLESS', note: '冬 × 许愿 · 限定小卡 3/5' }
  ];

  var giftEl = document.getElementById('gift');
  var giftGrid = document.getElementById('gift-grid');
  var giftZoom = document.getElementById('gift-zoom');
  var giftZoomImg = document.getElementById('gift-zoom-img');
  var giftZoomCap = document.getElementById('gift-zoom-cap');
  var giftZoomPrev = document.getElementById('gift-zoom-prev');
  var giftZoomNext = document.getElementById('gift-zoom-next');
  var giftBuilt = false;
  var giftZoomIndex = -1;

  function buildGiftGrid() {
    if (giftBuilt || !giftGrid) return;
    giftGrid.innerHTML = '';
    GIFT_WORKS.forEach(function (w, i) {
      var src = 'gift/' + w.f + '.jpg';
      var capText = w.name + ' · ' + w.note;
      var cell = document.createElement('div');
      cell.className = 'gift-cell';
      cell.setAttribute('role', 'button');
      cell.setAttribute('tabindex', '0');
      cell.setAttribute('aria-label', capText);
      cell.setAttribute('data-index', i);
      var img = document.createElement('img');
      img.src = src;
      img.alt = capText;
      img.loading = 'lazy';
      var cap = document.createElement('div');
      cap.className = 'cap';
      cap.innerHTML = w.name + '<small>' + w.note + '</small>';
      cell.appendChild(img);
      cell.appendChild(cap);
      giftGrid.appendChild(cell);
    });
    giftBuilt = true;
  }

  function giftZoomOpen() { return !!(giftZoom && giftZoom.classList.contains('show')); }
  function renderGiftZoom(index) {
    if (!GIFT_WORKS.length) return;
    index = (index + GIFT_WORKS.length) % GIFT_WORKS.length;
    giftZoomIndex = index;
    var w = GIFT_WORKS[index];
    giftZoomImg.src = 'gift/' + w.f + '.jpg';
    giftZoomImg.alt = w.name;
    giftZoomCap.textContent = w.name + ' · ' + (index + 1) + ' / ' + GIFT_WORKS.length;
    if (Sound.on) Sound.page();
  }
  function openGiftZoom(index) {
    if (!giftZoom) return;
    renderGiftZoom(index);
    giftZoom.classList.add('show');
    giftZoom.setAttribute('aria-hidden', 'false');
  }
  function closeGiftZoom() {
    if (!giftZoom) return;
    giftZoom.classList.remove('show');
    giftZoom.setAttribute('aria-hidden', 'true');
  }

  function openGift() {
    if (!giftEl) return;
    buildGiftGrid();
    if (artDetailOpen) closeArtDetail();
    if (commissionEl && commissionEl.classList.contains('show')) closeCommission();
    giftEl.classList.add('show');
    giftEl.setAttribute('aria-hidden', 'false');
    hideTooltip();
    hovered = null;
    if (Sound.on) Sound.page();
  }
  function closeGift() {
    if (!giftEl) return;
    closeGiftZoom();
    giftEl.classList.remove('show');
    giftEl.setAttribute('aria-hidden', 'true');
  }

  if (giftEl) {
    giftEl.addEventListener('click', function (e) {
      if (e.target === giftEl || e.target.classList.contains('gift-backdrop') ||
          e.target.id === 'gift-close') closeGift();
    });
    if (giftGrid) {
      giftGrid.addEventListener('click', function (e) {
        var cell = e.target.closest ? e.target.closest('.gift-cell') : null;
        if (cell) openGiftZoom(parseInt(cell.getAttribute('data-index'), 10) || 0);
      });
      giftGrid.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var cell = e.target.closest ? e.target.closest('.gift-cell') : null;
        if (cell) { e.preventDefault(); openGiftZoom(parseInt(cell.getAttribute('data-index'), 10) || 0); }
      });
    }
    if (giftZoom) {
      giftZoom.addEventListener('click', function (e) {
        if (e.target === giftZoom || e.target === giftZoomImg) closeGiftZoom();
      });
    }
    if (giftZoomPrev) giftZoomPrev.addEventListener('click', function (e) { e.stopPropagation(); renderGiftZoom(giftZoomIndex - 1); });
    if (giftZoomNext) giftZoomNext.addEventListener('click', function (e) { e.stopPropagation(); renderGiftZoom(giftZoomIndex + 1); });
    document.addEventListener('keydown', function (e) {
      if (giftZoomOpen()) {
        if (e.key === 'Escape') { closeGiftZoom(); return; }
        if (e.key === 'ArrowLeft') { renderGiftZoom(giftZoomIndex - 1); return; }
        if (e.key === 'ArrowRight') { renderGiftZoom(giftZoomIndex + 1); return; }
      }
      if (e.key === 'Escape' && giftEl.classList.contains('show')) closeGift();
    });
  }

  /* -----------------------------------------------------------------------
     24e. 桌上的书 ·「互相写的信」（五封往来，可翻页）
     ======================================================================= */
  var LETTERS = [
    {
      no: '第 一 封',
      orn: '— 以爱寻影　终开雾山 —',
      blocks: [
        { who: '许愿', kind: '来信', text: '你弹琴很好听，可是我是牛，还有可以不要坐在草上吗，那个我还要吃的' },
        { who: '冬',   kind: '回信', text: '这个许愿就这样装疯卖傻，我捡走了。ok啊，我想想怎么回' }
      ],
      tail: '感谢板板七夕返场日冠'
    },
    {
      no: '第 二 封',
      orn: '— 以爱寻影　终开雾山 —',
      blocks: [
        { who: '冬',   kind: '来信', text: '生活反复捶打使我恋爱压抑' },
        { who: '许愿', kind: '回信', text: '秀色可餐肉质紧实我吃之' }
      ],
      tail: '感谢板板日冠'
    },
    {
      no: '第 三 封',
      orn: '— 以爱寻影　终开雾山 —',
      blocks: [
        { who: '许愿', kind: '来信', text: '视奸完毕，没异常，但你有点太受欢迎了。除了我你还有别的朋友？跟她们绝交吧，有我就够了。' },
        { who: '冬',   kind: '回信', text: '怎么变成阴湿女鬼了，多晒晒太阳' },
        { who: '许愿', kind: '又来信', text: '你陪我就去' }
      ],
      tail: '感谢板板日冠'
    },
    {
      no: '第 四 封',
      orn: '— 以爱寻影　终开雾山 —',
      blocks: [
        { who: '冬', kind: '来信', text: '虽然我现在现实真的很忙然后压力也很大，但是很高兴遇见许愿老师。许愿老师这里是我忙碌之余难得能感到安心和放松的栖所。我总觉得爱的表达方式需要是多样的，于是一直很想送你些什么。但我说的那些你又说太贵重了。如果可以的话，给我一个你最能接受的形式吧。' },
        { who: '许愿', kind: '回信', text: '我一直都希望自己能够接住你，想要为你做的再多一点，听你讲今天好忙，夸你好厉害，见面的时候说想你，你靠着我的时候我也有了一处安心。真想送我礼物就把双手伸过来，我绑个蝴蝶结把这人领走了。' }
      ],
      tail: '感谢板板日冠'
    },
    {
      no: '第 五 封',
      orn: '— 以爱寻影　终开雾山 —',
      mono: 'NO4 ▸ +*以爱寻影，终开雾山*+\n' +
            'ing!\n' +
            '—✧—₊—*CRAZY*—₊—✧—\n' +
            '▼_WU SHANG YING_▼\n' +
            '╰( …『冬』∞『许愿』… )╯\n' +
            '小周冠！——START!',
      blocks: [
        { who: '冬', kind: '来信', text: '在这个人人都是不同程度的天才的学校里，紧张和焦虑的情绪总是如影随形。我生活中的痛苦，是那样琐碎而刺痛的。于是在我向喜欢的方向努力的时候，总是会突然崩溃。但你总是能很好的接住我，用你的方式来爱我。现在我终于有机会在我喜欢的方向的科研训练上起步。太阳能电池吗，我生命中已经拥有一个小太阳了。我们细水长流好不好' },
        { who: '许愿', kind: '回信！', text: '在这样的环境下不紧张和焦虑才是奇怪的吧，常常担心也是因为你有解决问题的能力。再厉害的人也有想发呆的时候，人人都是天才那我们做一颗白菜吧，感觉水灵灵的很好吃。你可以语无伦次可以沉默可以靠在我身上，我会去听你讲陪着你　去接住你疲惫的重量，额头抵着额头，闭上眼睛世界好像只有就我们两个人了。细水长流，你也长流，我也长流' }
      ],
      heart: true,
      tail: '☆何止 ☁今昔☆　·　I.★ Wu Shan Ying ★.l'
    }
  ];

  var lettersEl = document.getElementById('letters');
  var lettersPage = document.getElementById('letters-page');
  var lettersScroll = document.getElementById('letters-scroll');
  var lettersCounter = document.getElementById('letters-counter');
  var lettersPrev = document.getElementById('letters-prev');
  var lettersNext = document.getElementById('letters-next');
  var lettersIndex = 0;

  function lettersIsOpen() { return !!(lettersEl && lettersEl.classList.contains('show')); }

  /* 点阵心（第五封结尾的手绘小爱心） */
  function heartDots() {
    return '<svg class="let-heart" viewBox="0 0 24 22" fill="none" stroke="rgba(150,84,72,0.58)"' +
           ' stroke-width="0.5" stroke-linecap="round" stroke-dasharray="0.001 1.28" aria-hidden="true">' +
           '<path d="M12 20.2s-7.4-4.4-9.6-8.9C0.7 7.7 2.7 4 6.3 4c2.2 0 3.9 1.3 5.7 3.4C13.8 5.3 15.5 4 17.7 4c3.6 0 5.6 3.7 3.9 7.3-2.2 4.5-9.6 8.9-9.6 8.9z"/>' +
           '</svg>';
  }

  function renderLetter(i) {
    if (!lettersPage) return;
    var n = LETTERS.length;
    lettersIndex = ((i % n) + n) % n;
    var L = LETTERS[lettersIndex];

    var html = '<div class="let-eyebrow">互 相 写 的 信</div>';
    if (lettersIndex === 0) html += '<div class="let-intro">这本书读到第二十一页就停了，后面夹着这些。</div>';
    html += '<div class="let-orn">' + L.orn + '</div>';
    html += '<div class="let-orn-sub">☁ | Mist Mountain Shadow °</div>';
    if (L.mono) html += '<div class="let-mono">' + L.mono + '</div>';
    html += '<div class="let-orn-line">【雾山影】</div>';
    html += '<div class="let-no">' + L.no + '</div>';

    L.blocks.forEach(function (b) {
      var winter = b.who === '冬';
      html += '<div class="let-block ' + (winter ? 'winter' : 'wish') + '">' +
              '<div class="let-who"><span class="let-seal">' + (winter ? '冬' : '愿') + '</span>' +
              '<em>' + b.who + ' · ' + b.kind + '</em></div>' +
              '<p class="let-text">' + b.text + '</p></div>';
    });

    if (L.heart) html += heartDots();
    html += '<div class="let-sign">『冬』 &amp; 『许愿』</div>';
    html += '<div class="let-end">— ' + L.tail + ' —　·　祝小宝玩的开心…</div>';

    lettersPage.innerHTML = html;
    lettersPage.classList.remove('turning');
    void lettersPage.offsetWidth;
    lettersPage.classList.add('turning');

    if (lettersScroll) lettersScroll.scrollTop = 0;
    updateLetterScrollHint();
    if (lettersCounter) lettersCounter.textContent = '第 ' + (lettersIndex + 1) + ' 封 · 共 ' + n + ' 封';
    if (lettersPrev) lettersPrev.disabled = false;
    if (lettersNext) lettersNext.disabled = false;
  }

  /* 内容超过一页时，底部渐隐提示还能往下滑 */
  function updateLetterScrollHint() {
    if (!lettersScroll) return;
    var rest = lettersScroll.scrollHeight - lettersScroll.scrollTop - lettersScroll.clientHeight;
    lettersScroll.classList.toggle('has-more', rest > 24);
  }
  if (lettersScroll) lettersScroll.addEventListener('scroll', updateLetterScrollHint);

  function openLetters() {
    if (!lettersEl) return;
    renderLetter(0);
    if (artDetailOpen) closeArtDetail();
    if (commissionEl && commissionEl.classList.contains('show')) closeCommission();
    if (giftEl && giftEl.classList.contains('show')) closeGift();
    lettersEl.classList.add('show');
    lettersEl.setAttribute('aria-hidden', 'false');
    hideTooltip();
    hovered = null;
    if (Sound.on) Sound.page();
  }

  function closeLetters() {
    if (!lettersEl) return;
    lettersEl.classList.remove('show');
    lettersEl.setAttribute('aria-hidden', 'true');
  }

  if (lettersEl) {
    lettersEl.addEventListener('click', function (e) {
      if (e.target === lettersEl || e.target.classList.contains('letters-backdrop') ||
          e.target.id === 'letters-close') { closeLetters(); return; }
    });
    /* 点在书页左右外侧也能翻页（像翻书一样） */
    if (lettersPrev) lettersPrev.addEventListener('click', function (e) { e.stopPropagation(); renderLetter(lettersIndex - 1); });
    if (lettersNext) lettersNext.addEventListener('click', function (e) { e.stopPropagation(); renderLetter(lettersIndex + 1); });
    document.addEventListener('keydown', function (e) {
      if (!lettersIsOpen()) return;
      if (e.key === 'Escape') { closeLetters(); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); renderLetter(lettersIndex - 1); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); renderLetter(lettersIndex + 1); }
    });
  }

  function triggerItem(target) {
    var d = target.userData;

    /* 书：打开「互相写的信」信集；仍计入 8 项进度 */
    if (d.letterPage) {
      bounce(target, 0.05);
      spawnSparks(worldPos(target), d.found ? 0xffd9a0 : 0xffc98a, d.found ? 6 : 16);
      if (!d.found) {
        d.found = true; found++; updateProgress();
        if (found >= CONFIG.items.length) setTimeout(finale, 1300);
      }
      openLetters();
      return;
    }

    /* 礼物盒：打开「礼物盒」作品集；仍计入 8 项进度 */
    if (d.giftPage) {
      bounce(target, 0.05);
      spawnSparks(worldPos(target), d.found ? 0xffd9a0 : 0xffc98a, d.found ? 6 : 16);
      if (d.react) { try { d.react(); } catch (err) {} }
      if (!d.found) {
        d.found = true; found++; updateProgress();
        if (found >= CONFIG.items.length) setTimeout(finale, 1300);
      }
      openGift();
      return;
    }

    /* 画板：打开「和你的约稿」专属作品页 */
    if (d.commissionPage) {
      openCommission();
      bounce(target, 0.05);
      spawnSparks(worldPos(target), 0xffc98a, 12);
      return;
    }

    /* 画作：打开详情页（大图 + 标题 + 描述），不弹小卡片、不计入进度 */
    if (d.artDetail) {
      openArtDetail(d.artKind);
      bounce(target, 0.05);
      spawnSparks(worldPos(target), 0xffc98a, 12);
      return;
    }

    bounce(target, 0.05);
    spawnSparks(worldPos(target), d.found ? 0xffd9a0 : 0xffc98a, d.found ? 6 : 16);
    if (d.react) { try { d.react(); } catch (err) {} }
    showToast(d.name, d.text);
    if (!d.found && !d.infoOnly) {
      d.found = true;
      found++;
      updateProgress();
      if (found >= CONFIG.items.length) setTimeout(finale, 1300);
    } else if (d.infoOnly) {
      d.found = true;     // 已看过，但仍不计入进度
    }
  }

  function worldPos(obj) {
    var v = new T.Vector3();
    obj.getWorldPosition(v);
    v.y += 0.4;
    return v;
  }

  var sparks = [];
  function spawnSparks(pos, color, n) {
    for (var i = 0; i < n; i++) {
      var sp = new T.Sprite(new T.SpriteMaterial({
        map: texGlow, color: color, transparent: true, opacity: 1,
        blending: T.AdditiveBlending, depthWrite: false
      }));
      sp.position.copy(pos);
      var s = rand(0.12, 0.3);
      sp.scale.setScalar(s);
      noRaycast(sp);
      scene.add(sp);
      sparks.push({
        s: sp,
        v: new T.Vector3(rand(-1.4, 1.4), rand(0.4, 2.4), rand(-1.4, 1.4)),
        life: 0, max: rand(0.9, 1.7), size: s
      });
    }
  }

  function updateSparks(dt) {
    for (var i = sparks.length - 1; i >= 0; i--) {
      var p = sparks[i];
      p.life += dt;
      var t = p.life / p.max;
      if (t >= 1) {
        scene.remove(p.s);
        p.s.material.dispose();
        sparks.splice(i, 1);
        continue;
      }
      p.v.y -= 1.3 * dt;
      p.v.multiplyScalar(1 - 1.2 * dt);
      p.s.position.addScaledVector(p.v, dt);
      p.s.material.opacity = 1 - t * t;
      p.s.scale.setScalar(p.size * (1 + t * 1.6));
    }
  }

  /* =======================================================================
     25. 终章
     ======================================================================= */
  var finaleEl = document.getElementById('finale');

  function finale() {
    finaleEl.classList.add('show');
    finaleEl.setAttribute('aria-hidden', 'false');
    spawnSparks(new T.Vector3(0, 3.2, 0), 0xffd9a0, 40);
    [
      new T.Vector3(-3.4, 2.6, 0),
      new T.Vector3(3.4, 2.6, 0),
      new T.Vector3(0, 4.6, -2),
      new T.Vector3(0, 4.4, 2)
    ].forEach(function (p, i) {
      setTimeout(function () { spawnSparks(p, 0xffc48a, 22); }, 200 + i * 260);
    });
    if (Sound.on) Sound.chime(true);
  }

  document.getElementById('btn-again').addEventListener('click', function () {
    finaleEl.classList.remove('show');
    finaleEl.setAttribute('aria-hidden', 'true');
    found = 0;
    CONFIG.items.forEach(function (it) {
      var el = itemById[it.id];
      if (el) el.userData.found = false;
    });
    updateProgress();
    giftObj.lid.userData.open = 0;
    giftObj.lid.position.y = 0.6;
    giftObj.lid.rotation.set(0, 0, 0);
    cat.userData.stretch = 0;
    gramoObj.horn.rotation.x = 0.42;
    gramoObj.record.userData.spin = 0;
    cam.tTheta = 0.82;
    cam.tPhi = 1.0;
  });

  /* =======================================================================
     26. 声音（WebAudio 实时合成）
     ======================================================================= */
  var Sound = (function () {
    var ctx = null, master = null, on = false, padTimer = null, pluckTimer = null;
    var radioEl = null, radioSrc = null, radioOn = false;
    var chordIdx = 0;
    var chords = [
      [174.61, 261.63, 329.63, 392.00],
      [130.81, 196.00, 261.63, 329.63],
      [146.83, 220.00, 293.66, 349.23],
      [110.00, 164.81, 261.63, 329.63]
    ];
    var scale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];

    var chordIdx = 0;
    var chords = [
      [174.61, 261.63, 329.63, 392.00],
      [130.81, 196.00, 261.63, 329.63],
      [146.83, 220.00, 293.66, 349.23],
      [110.00, 164.81, 261.63, 329.63]
    ];
    var scale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];

    /* ===== 留声机旋律：八音盒风的八小节循环（WebAudio 合成，无外部素材） ===== */
    var musicOn = false, musicTimer = null, musicStep = 0, musicGain = null;
    // C 大调五声音阶 + 经过音，温和上行下行的摇篮曲式旋律（单位：Hz）
    var melody = [
      523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 392.00,
      440.00, 523.25, 587.33, 440.00, 392.00, 523.25, 392.00, 293.66,
      523.25, 659.25, 783.99, 880.00, 783.99, 659.25, 587.33, 523.25,
      392.00, 440.00, 523.25, 392.00, 293.66, 392.00, 261.63, 196.00
    ];
    // 每步对应的低音（根音），营造和声进行
    var bassLine = [
      130.81, 130.81, 130.81, 130.81, 174.61, 174.61, 174.61, 174.61,
      196.00, 196.00, 196.00, 196.00, 130.81, 130.81, 130.81, 130.81,
      261.63, 261.63, 261.63, 261.63, 220.00, 220.00, 220.00, 220.00,
      174.61, 174.61, 174.61, 174.61, 130.81, 130.81, 130.81, 98.00
    ];

    function note(freq, when, dur, vol, type, detune) {
      var o = ctx.createOscillator();
      o.type = type || 'triangle';
      o.frequency.value = freq;
      o.detune.value = detune || 0;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(vol, when + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = type === 'sine' ? 1400 : 3200;
      o.connect(g); g.connect(lp); lp.connect(musicGain || master);
      o.start(when); o.stop(when + dur + 0.05);
    }

    function scheduleMusicBar() {
      if (!ctx || !musicOn) return;
      var now = ctx.currentTime + 0.05;
      var stepDur = 0.42;                       // 每步 ~0.42s，整圈 ~13.4s
      for (var i = 0; i < 8; i++) {
        var f = melody[(musicStep + i) % melody.length];
        var t = now + i * stepDur;
        // 主旋律（八音盒三角波，略带高频泛音）
        note(f, t, stepDur * 1.7, 0.12, 'triangle', rand(-4, 4));
        // 高八度回声（弱）
        note(f * 2, t + 0.04, stepDur * 1.2, 0.035, 'sine', 0);
        // 低音根音（每两步一个长音）
        if (i % 2 === 0) {
          var bf = bassLine[(musicStep + i) % bassLine.length];
          note(bf, t, stepDur * 3.4, 0.07, 'sine', 0);
        }
      }
      musicStep = (musicStep + 8) % melody.length;
      musicTimer = setTimeout(scheduleMusicBar, stepDur * 8 * 1000 - 120);
    }

    function startMusic() {
      if (!ensure()) return;
      try { if (ctx.state === 'suspended') ctx.resume(); } catch (e) {}
      if (musicOn) return;
      musicOn = true;
      if (!musicGain) {
        musicGain = ctx.createGain();
        musicGain.gain.value = 0;
        musicGain.connect(master);
      }
      musicGain.gain.cancelScheduledValues(ctx.currentTime);
      musicGain.gain.setTargetAtTime(0.9, ctx.currentTime, 0.6);
      musicStep = 0;
      scheduleMusicBar();
    }
    function stopMusic() {
      musicOn = false;
      if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
      if (musicGain && ctx) {
        musicGain.gain.cancelScheduledValues(ctx.currentTime);
        musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      }
    }

    function ensure() {
      if (ctx) return true;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);
      } catch (e) { ctx = null; return false; }
      return true;
    }

    /* 留声机 mp3：从视频提取的背景音乐，单曲循环；经 master 受总音量控制 */
    function ensureRadio() {
      if (radioEl) return true;
      if (!ctx) return false;
      try {
        radioEl = new Audio('audio/radio.mp3');
        radioEl.loop = true;
        radioEl.preload = 'auto';
        radioSrc = ctx.createMediaElementSource(radioEl);
        radioSrc.connect(master);
      } catch (e) { radioSrc = null; }
      return true;
    }

    function pad() {
      if (!ctx || !on) return;
      var now = ctx.currentTime;
      var chord = chords[chordIdx % chords.length];
      chordIdx++;
      var dur = 8.6;
      chord.forEach(function (f, i) {
        var o = ctx.createOscillator();
        o.type = i === 0 ? 'sine' : 'triangle';
        o.frequency.value = f;
        o.detune.value = rand(-6, 6);
        var g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.05 / (i * 0.5 + 1), now + 2.6);
        g.gain.linearRampToValueAtTime(0.0001, now + dur);
        var lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.4;
        o.connect(g); g.connect(lp); lp.connect(master);
        o.start(now); o.stop(now + dur + 0.2);
      });
    }

    function pluck() {
      if (!ctx || !on) return;
      var now = ctx.currentTime;
      var o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = pick(scale);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.065, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2600;
      o.connect(g); g.connect(lp); lp.connect(master);
      o.start(now); o.stop(now + 2.4);
    }

    function blip(freqs, vol, dur) {
      if (!ctx) return;
      var now = ctx.currentTime;
      freqs.forEach(function (f, i) {
        var o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        var g = ctx.createGain();
        var t0 = now + i * 0.075;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(master);
        o.start(t0); o.stop(t0 + dur + 0.05);
      });
    }

    return {
      get on() { return on; },
      enable: function () {
        if (!ensure()) return;
        try { if (ctx.state === 'suspended') ctx.resume(); } catch (e) {}
        on = true;
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(0.5, ctx.currentTime, 0.8);
        if (!padTimer) {
          pad();
          padTimer = setInterval(pad, 8200);
          pluckTimer = setInterval(function () { if (Math.random() > 0.35) pluck(); }, 2600);
        }
        var btn = document.getElementById('btn-sound');
        btn.classList.add('is-on');
        btn.setAttribute('aria-pressed', 'true');
        var lbl = document.getElementById('sound-label');
        if (lbl) lbl.textContent = '声音';
      },
      disable: function () {
        on = false;
        stopMusic();
        if (ctx) {
          master.gain.cancelScheduledValues(ctx.currentTime);
          master.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
        }
        var btn = document.getElementById('btn-sound');
        btn.classList.remove('is-on');
        btn.setAttribute('aria-pressed', 'false');
        var lbl = document.getElementById('sound-label');
        if (lbl) lbl.textContent = '声音';
      },
      toggle: function () { on ? Sound.disable() : Sound.enable(); },
      chime: function (big) { blip(big ? [880, 1174.66] : [659.25, 987.77], 0.09, 0.9); },
      page: function () { blip([420, 380], 0.05, 0.35); },
      purr: function () { blip([110, 138], 0.045, 0.7); },
      music: function (state) { state ? startMusic() : stopMusic(); },
      musicPlaying: function () { return musicOn; },
      radio: function () { return radioEl; },
      playRadio: function () {
        if (!ensure()) return;
        if (!ensureRadio()) return;
        try { var p = radioEl.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
        radioOn = true;
      },
      stopRadio: function () {
        if (radioEl) try { radioEl.pause(); } catch (e) {}
        radioOn = false;
      },
      radioPlaying: function () { return radioOn; }
    };
  })();

  var audioKicked = false;
  function audioKick() {
    if (CONFIG.autoSound && !Sound.on && !audioKicked) {
      audioKicked = true;
      Sound.enable();
    }
  }

  document.getElementById('btn-sound').addEventListener('click', function () { Sound.toggle(); });
  document.getElementById('btn-reset').addEventListener('click', function () {
    cam.tTheta = 0.82;
    cam.tPhi = 1.0;
    fitCamera();
    idleT = 0;
  });

  /* =======================================================================
     27. 动画
     ======================================================================= */
  var clock = new T.Clock();
  var elapsed = 0;
  var started = false;
  var veil = document.getElementById('veil');
  var sceneHint = document.getElementById('scene-hint');
  var hoverTick = 0;

  window.addEventListener('resize', fitCamera);
  window.addEventListener('orientationchange', function () { setTimeout(fitCamera, 260); });

  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    if (!started) {
      started = true;
      setTimeout(function () { veil.classList.add('hide'); }, 140);
      setTimeout(function () { sceneHint.classList.add('hide'); }, 9000);
    }

    introT += dt;
    idleT += dt;

    applyCamera(dt);

    /* 灯串点亮 */
    for (var i = 0; i < lightStrings.length; i++) {
      var ls = lightStrings[i];
      var t0 = clamp((elapsed - 0.7 - ls.delay) / 1.5, 0, 1);
      var targetL = ls.base * t0 + flashLights * 1.5;
      ls.mat.emissiveIntensity = lerp(ls.mat.emissiveIntensity, targetL, 1 - Math.exp(-6 * dt));
      ls.glow.opacity = lerp(ls.glow.opacity, t0 * 0.72, 1 - Math.exp(-5 * dt));
    }
    flashLights = Math.max(0, flashLights - dt * 1.2);

    /* 灯笼 / 光球 */
    for (var j = 0; j < lanterns.length; j++) {
      var ln = lanterns[j];
      ln.g.position.y = ln.baseY + Math.sin(elapsed * ln.spd + ln.phase) * 0.075;
      ln.g.rotation.y = Math.sin(elapsed * 0.2 + ln.phase) * 0.15;
      var pulse = 1 + Math.sin(elapsed * 1.5 + ln.phase) * 0.05;
      ln.halo.scale.setScalar(ln.haloSize * pulse);
      ln.halo.material.opacity = 0.48 + Math.sin(elapsed * 1.5 + ln.phase) * 0.1;
    }

    /* 窗光 */
    if (winObj) {
      var wp = winObj.glow.userData.pulse || 0;
      var glowOp = 0.19 + Math.sin(elapsed * 0.9) * 0.035 + wp * 0.3;
      winObj.glow.material.opacity = lerp(winObj.glow.material.opacity, glowOp, 1 - Math.exp(-4 * dt));
      winObj.glow.userData.pulse = Math.max(0, wp - dt * 0.9);
      if (winObj.pool) winObj.pool.material.opacity = 0.16 + Math.sin(elapsed * 0.9) * 0.03 + wp * 0.16;
    }

    /* 猫呼吸 */
    if (cat) {
      var breathe = 1 + Math.sin(elapsed * 1.05) * 0.018;
      var st = cat.userData.stretch || 0;
      var k2 = st > 0 ? Math.sin(st * Math.PI) * 0.14 : 0;
      cat.scale.set(1.32, 1.32 * breathe * (1 - k2 * 0.5), 1.32 * (1 + k2));
      if (st > 0) cat.userData.stretch = Math.max(0, st - dt * 1.1);
    }

    /* 礼物盒开盖 */
    if (giftObj && giftObj.lid.userData.open) {
      giftObj.lid.position.y = lerp(giftObj.lid.position.y, 0.88, 1 - Math.exp(-6 * dt));
      giftObj.lid.rotation.y = lerp(giftObj.lid.rotation.y, 0.35, 1 - Math.exp(-5 * dt));
      giftObj.lid.rotation.z = lerp(giftObj.lid.rotation.z, 0.07, 1 - Math.exp(-5 * dt));
    }

    /* 唱片 */
    if (gramoObj) {
      var spin = gramoObj.record.userData.spin || 0;
      if (spin > 0) {
        gramoObj.record.rotation.y += dt * 3.2;
        gramoObj.record.userData.spin = Math.max(0, spin - dt * 0.18);
      }
    }

    /* 悬停 & 弹跳 */
    for (var k = 0; k < pickables.length; k++) {
      var p = pickables[k];
      var want = (hovered === p) ? 1.03 : 1;
      p.userData.hover = lerp(p.userData.hover, want, 1 - Math.exp(-12 * dt));
      var bs = p.userData.__bounce || 0;
      var extra = 0;
      if (bs > 0) {
        extra = Math.sin(bs * Math.PI * 3) * (p.userData.__bounceAmt || 0.05) * bs;
        p.userData.__bounce = Math.max(0, bs - dt * 2.2);
      }
      var sc = p.userData.hover + extra;
      p.scale.set(sc, sc, sc);
    }

    /* 补间 */
    for (var m = tweens.length - 1; m >= 0; m--) {
      var tw = tweens[m];
      tw.t += dt;
      if (tw.t < 0) continue;
      var pr = clamp(tw.t / tw.dur, 0, 1);
      var e = 1 - Math.pow(1 - pr, 3);
      tw.obj[tw.key] = lerp(tw.from, tw.to, e);
      if (pr >= 1) tweens.splice(m, 1);
    }

    /* 尘埃 */
    if (dust) {
      var arr = dust.geometry.attributes.position;
      for (var d = 0; d < arr.count; d++) {
        var y = arr.getY(d) + dt * 0.045;
        if (y > 5.4) y = 0.2;
        arr.setY(d, y);
      }
      arr.needsUpdate = true;
      dust.material.opacity = 0.36 + Math.sin(elapsed * 0.7) * 0.12;
    }

    /* 星空 */
    if (starField) starField.rotation.y += dt * 0.004;
    for (var b = 0; b < bigStars.length; b++) {
      bigStars[b].material.opacity = 0.35 + Math.abs(Math.sin(elapsed * bigStars[b].userData.tw)) * 0.45;
    }

    updateSparks(dt);

    hoverTick += dt;
    if (hoverTick > 0.06) {
      hoverTick = 0;
      if (!drag.active) updateHover();
    }

    renderer.render(scene, camera);
  }

  /* 启动 */
  fitCamera();
  cam.cTheta = 1.24;
  cam.cPhi = 0.62;
  cam.cR = cam.maxR;
  cam.tTheta = 0.82;
  cam.tPhi = 1.0;
  camera.position.set(24, 40, 44);
  animate();

  canvas.addEventListener('dblclick', function (e) { e.preventDefault(); });

  /* 调试钩子（不影响界面，仅供自动化测试 / 控制台调试使用） */
  window.__starlight = {
    items: itemById,
    trigger: function (id) { if (itemById[id]) triggerItem(itemById[id]); },
    finale: finale,
    count: function () { return found; },
    musicPlaying: function () { return Sound.musicPlaying(); },
    radioPlaying: function () { return Sound.radioPlaying(); },
    radio: function () { return Sound.radio(); },
    openArt: function (kind) { openArtDetail(kind); },
    artOpen: function () { return artDetailOpen; },
    closeArt: function () { closeArtDetail(); },
    artOrder: function () { return artOrder.slice(); },
    artIndex: function () { return artCurrentIndex; },
    artNav: function (delta) { artRenderAt(artCurrentIndex + (delta || 1)); },
    openCommission: function () { openCommission(); },
    closeCommission: function () { closeCommission(); },
    commissionOpen: function () { return !!(commissionEl && commissionEl.classList.contains('show')); },
    commissionCount: function () { return COMMISSION_WORKS.length; },
    openCommissionZoom: function (i) {
      var w = COMMISSION_WORKS[i || 0];
      if (w) openZoom('commission/' + w.f + '.jpg', w.name + ' · ' + w.note);
    },
    commissionZoomOpen: function () { return zoomOpen(); },
    openGift: function () { openGift(); },
    closeGift: function () { closeGift(); },
    giftOpen: function () { return !!(giftEl && giftEl.classList.contains('show')); },
    giftCount: function () { return GIFT_WORKS.length; },
    openGiftZoom: function (i) { openGiftZoom(i || 0); },
    giftZoomOpen: function () { return giftZoomOpen(); },
    giftZoomNav: function (d) { renderGiftZoom(giftZoomIndex + (d || 1)); },
    giftZoomIndex: function () { return giftZoomIndex; },
    openLetters: function () { openLetters(); },
    closeLetters: function () { closeLetters(); },
    lettersOpen: function () { return lettersIsOpen(); },
    lettersCount: function () { return LETTERS.length; },
    letterIndex: function () { return lettersIndex; },
    letterNav: function (d) { renderLetter(lettersIndex + (d || 1)); },
    scene: scene,
    room: room,
    camera: camera,
    pickables: function () { return pickables; },
    stats: function () {
      var meshes = 0, groups = 0;
      room.traverse(function (o) {
        if (o.isMesh) meshes++;
        if (o.isGroup) groups++;
      });
      var box = new T.Box3().setFromObject(room);
      return { meshes: meshes, groups: groups, box: box.min.toArray().map(function (n){return +n.toFixed(2);}).concat(box.max.toArray().map(function (n){return +n.toFixed(2);})) };
    }
  };

})();
