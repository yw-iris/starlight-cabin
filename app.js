/* =========================================================================
   星光小屋 · Starlight Cabin
   -------------------------------------------------------------------------
   纯程序化 3D 场景（除 three.js 外无任何外部图片 / 模型）：
   陶土色小房间 · 粉沙发 · 圆茶几 · 睡着的猫 · 礼物盒 · 留声机
   拱形窗 · 灯串 · 悬浮纸灯笼 · 星空

   交互：拖动旋转 / 滚轮或双指缩放 / 点击 8 个物件触发惊喜
   ========================================================================= */
(function () {
  'use strict';

  var T = THREE;

  /* =======================================================================
     0. 配置
     ======================================================================= */
  var CONFIG = {
    room: { w: 8.4, d: 8.4, h: 5.5, t: 0.34 },
    camera: { fitRadius: 5.85 },
    autoSound: true,

    items: [
      { id: 'sofa',   name: '沙发',   text: '这里永远留一个位置给你，<br/>坐多久都可以。' },
      { id: 'gramo',  name: '唱片机', text: '同一首歌单曲循环了一整晚，<br/>还是想再听一遍。' },
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
  var TARGET = new T.Vector3(0, 1.62, 0);

  var clamp = T.MathUtils.clamp;
  var lerp = T.MathUtils.lerp;
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var randInt = function (a, b) { return Math.floor(rand(a, b + 1)); };
  var pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };

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

  /** 带倒角的圆角立方体 */
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

  /* 木地板：横向长条木纹 */
  var texWood = canvasTex(1024, 1024, function (ctx, w, h) {
    ctx.fillStyle = '#b0824d';
    ctx.fillRect(0, 0, w, h);
    var rows = 15, rh = h / rows;
    for (var i = 0; i < rows; i++) {
      var l = 168 + rand(-16, 16);
      ctx.fillStyle = 'rgb(' + Math.round(l) + ',' + Math.round(l * 0.762) + ',' + Math.round(l * 0.528) + ')';
      ctx.fillRect(0, i * rh, w, rh);
      for (var g = 0; g < 26; g++) {
        ctx.strokeStyle = 'rgba(122,82,46,' + rand(0.02, 0.065).toFixed(3) + ')';
        ctx.lineWidth = rand(0.6, 2.2);
        ctx.beginPath();
        var y0 = i * rh + rand(0, rh);
        ctx.moveTo(0, y0);
        for (var x = 0; x <= w; x += 48) {
          ctx.lineTo(x, y0 + Math.sin(x * 0.011 + g * 1.7) * rand(1.5, 5));
        }
        ctx.stroke();
      }
      var seam = ((i % 2) ? 0.34 : 0.71) * w;
      ctx.fillStyle = 'rgba(84,54,28,0.34)';
      ctx.fillRect(seam, i * rh, 3, rh);
      ctx.fillStyle = 'rgba(80,50,26,0.4)';
      ctx.fillRect(0, i * rh + rh - 3, w, 3);
      ctx.fillStyle = 'rgba(255,236,205,0.07)';
      ctx.fillRect(0, i * rh, w, 2);
    }
  });

  /* 墙面涂料 */
  var texPlaster = canvasTex(512, 512, function (ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#dba484');
    g.addColorStop(0.5, '#c88a68');
    g.addColorStop(1, '#ab7355');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < 5200; i++) {
      var l = Math.random();
      ctx.fillStyle = l > 0.5
        ? 'rgba(255,240,225,' + rand(0.02, 0.09).toFixed(3) + ')'
        : 'rgba(150,95,62,' + rand(0.015, 0.065).toFixed(3) + ')';
      ctx.fillRect(rand(0, w), rand(0, h), rand(0.6, 2.2), rand(0.6, 2.2));
    }
  }, { repeat: [0.4, 0.4] });

  /* 窗外夜色 */
  var texWindow = canvasTex(512, 640, function (ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2b2444');
    g.addColorStop(0.3, '#6b4a5c');
    g.addColorStop(0.55, '#d98c62');
    g.addColorStop(0.76, '#f6c58c');
    g.addColorStop(1, '#fbe4bb');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    var rg = ctx.createRadialGradient(w * 0.52, h * 0.68, 6, w * 0.52, h * 0.68, w * 0.6);
    rg.addColorStop(0, 'rgba(255,244,220,0.8)');
    rg.addColorStop(0.35, 'rgba(255,214,160,0.5)');
    rg.addColorStop(1, 'rgba(255,190,130,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(120,74,74,0.38)';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.87);
    ctx.bezierCurveTo(w * 0.25, h * 0.79, w * 0.42, h * 0.91, w * 0.62, h * 0.84);
    ctx.bezierCurveTo(w * 0.8, h * 0.78, w * 0.9, h * 0.87, w, h * 0.83);
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(74,44,44,0.45)';
    ctx.lineCap = 'round';
    for (var i = 0; i < 5; i++) {
      var x0 = w * rand(0.02, 0.98);
      ctx.lineWidth = rand(1.6, 3.4);
      ctx.beginPath();
      ctx.moveTo(x0, h);
      ctx.quadraticCurveTo(x0 + rand(-30, 30), h * 0.72, x0 + rand(-70, 70), h * rand(0.35, 0.6));
      ctx.stroke();
    }
  }, { clamp: true });

  /* 地毯 */
  var texRug = canvasTex(512, 512, function (ctx, w, h) {
    var c = w / 2;
    var g = ctx.createRadialGradient(c, c, 4, c, c, c);
    g.addColorStop(0, '#f8d6d9');
    g.addColorStop(0.55, '#eeb6bd');
    g.addColorStop(0.84, '#e2a3ac');
    g.addColorStop(0.9, '#f3c4c8');
    g.addColorStop(1, '#d99aa4');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < 800; i++) {
      ctx.strokeStyle = 'rgba(255,255,255,' + rand(0.02, 0.07).toFixed(3) + ')';
      ctx.lineWidth = 1;
      var a = rand(0, 6.283), r = rand(0.2, 1) * c;
      ctx.beginPath();
      ctx.arc(c, c, r, a, a + 0.06);
      ctx.stroke();
    }
  }, { clamp: true });

  /* 挂画 */
  var texArt = canvasTex(420, 340, function (ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#3a2c50');
    g.addColorStop(0.55, '#8a5462');
    g.addColorStop(1, '#e0a06f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(255,245,225,0.92)';
    ctx.beginPath();
    ctx.arc(w * 0.66, h * 0.42, 44, 0, 6.283);
    ctx.fill();

    ctx.fillStyle = 'rgba(58,38,54,0.72)';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.78);
    ctx.bezierCurveTo(w * 0.3, h * 0.62, w * 0.5, h * 0.86, w * 0.72, h * 0.74);
    ctx.bezierCurveTo(w * 0.86, h * 0.67, w * 0.94, h * 0.76, w, h * 0.72);
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,250,235,0.75)';
    for (var i = 0; i < 26; i++) {
      ctx.fillRect(rand(0, w), rand(0, h * 0.55), rand(0.7, 2), rand(0.7, 2));
    }
  }, { clamp: true });

  /* 接触阴影 */
  var texAO = canvasTex(256, 256, function (ctx, w, h) {
    var g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(64,34,18,0.5)');
    g.addColorStop(0.4, 'rgba(64,34,18,0.22)');
    g.addColorStop(0.72, 'rgba(64,34,18,0.06)');
    g.addColorStop(1, 'rgba(58,28,14,0)');
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
     3. 渲染器 / 场景 / 相机
     ======================================================================= */
  var canvas = document.getElementById('scene');
  var pane = document.getElementById('pane-scene');

  var renderer = new T.WebGLRenderer({
    canvas: canvas, antialias: true, alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(30, 1, 0.5, 280);

  /* 环境贴图 */
  var envTex = canvasTex(1024, 512, function (ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0a0812');
    g.addColorStop(0.42, '#241c30');
    g.addColorStop(0.6, '#4a3126');
    g.addColorStop(1, '#0c0a12');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    var g1 = ctx.createRadialGradient(w * 0.72, h * 0.56, 8, w * 0.72, h * 0.56, 230);
    g1.addColorStop(0, 'rgba(255,222,170,1)');
    g1.addColorStop(0.4, 'rgba(255,186,132,0.45)');
    g1.addColorStop(1, 'rgba(255,170,120,0)');
    ctx.fillStyle = g1;
    ctx.beginPath(); ctx.arc(w * 0.72, h * 0.56, 230, 0, 6.283); ctx.fill();

    var g2 = ctx.createRadialGradient(w * 0.18, h * 0.4, 8, w * 0.18, h * 0.4, 170);
    g2.addColorStop(0, 'rgba(160,180,255,0.75)');
    g2.addColorStop(1, 'rgba(120,140,255,0)');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(w * 0.18, h * 0.4, 170, 0, 6.283); ctx.fill();
  }, { clamp: true });

  envTex.mapping = T.EquirectangularReflectionMapping;
  var pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(envTex).texture;
  pmrem.dispose();

  /* =======================================================================
     4. 材质
     ======================================================================= */
  function std(color, o) {
    o = o || {};
    return new T.MeshStandardMaterial(Object.assign({
      color: color, roughness: 0.92, metalness: 0.0, envMapIntensity: 0.22
    }, o));
  }

  var M = {
    wall: std(0xffffff, { map: texPlaster, roughness: 0.97, envMapIntensity: 0.18 }),
    plinth: std(0x9a5d3c, { roughness: 0.95, envMapIntensity: 0.28 }),
    plinthTop: std(0xb1704a, { roughness: 0.95 }),
    floor: std(0xffffff, { map: texWood, roughness: 0.72, envMapIntensity: 0.22 }),
    trim: std(0xf2ddc2, { roughness: 0.8, envMapIntensity: 0.55 }),
    cream: std(0xeed8b8, { roughness: 0.85 }),
    creamTrim: std(0xe8d0ac, { roughness: 0.8 }),
    pink: std(0xd4848a, { roughness: 0.88 }),
    pinkDeep: std(0xc97e82, { roughness: 0.88 }),
    pinkSoft: std(0xe0a09c, { roughness: 0.9 }),
    blush: std(0xf0cbc2, { roughness: 0.9 }),
    wood: std(0x9c6a3f, { roughness: 0.72 }),
    woodDark: std(0x7a4f2b, { roughness: 0.7 }),
    woodLight: std(0xb8834c, { roughness: 0.75 }),
    gold: std(0xe3ae5e, { roughness: 0.3, metalness: 0.95, envMapIntensity: 1.5 }),
    goldSoft: std(0xd9a45c, { roughness: 0.45, metalness: 0.7, envMapIntensity: 1.1 }),
    grass: std(0x5c7a45, { roughness: 0.95 }),
    grassDark: std(0x4b683a, { roughness: 0.95 }),
    leaf: std(0x5f8348, { roughness: 0.9 }),
    leafDark: std(0x41613a, { roughness: 0.9 }),
    terracotta: std(0xbe7a54, { roughness: 0.9 }),
    white: std(0xfdf7ee, { roughness: 0.92 }),
    cream2: std(0xf2e4cd, { roughness: 0.9 }),
    dark: std(0x3b3038, { roughness: 0.75 }),
    bookGreen: std(0x7d9b6b, { roughness: 0.85 }),
    bookRed: std(0xc0766a, { roughness: 0.85 }),
    rug: std(0xffffff, { map: texRug, roughness: 0.98, envMapIntensity: 0.28 }),
    art: std(0xffffff, {
      map: texArt, roughness: 0.85,
      emissive: 0xffd0a0, emissiveIntensity: 0.35
    })
  };

  /* =======================================================================
     5. 灯光
     ======================================================================= */
  scene.add(new T.HemisphereLight(0xffd4b4, 0x161222, 0.34));

  var key = new T.DirectionalLight(0xffe3c4, 1.1);
  key.position.set(5.5, 13, 11);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 11;
  key.shadow.camera.bottom = -8;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 45;
  key.shadow.bias = -0.0009;
  key.shadow.normalBias = 0.03;
  scene.add(key);
  scene.add(key.target);

  var fill = new T.PointLight(0xffa878, 0.55, 15, 2);
  fill.position.set(0.6, 3.4, -0.3);
  scene.add(fill);

  var windowLight = new T.PointLight(0xffc48c, 0.8, 13, 2);
  windowLight.position.set(2.35, 2.9, -3.0);
  scene.add(windowLight);

  var rim = new T.DirectionalLight(0x8b9bff, 0.32);
  rim.position.set(-9, 5.5, -7);
  scene.add(rim);

  /* =======================================================================
     6. 房间外壳
     ======================================================================= */
  var room = new T.Group();
  scene.add(room);

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
    // 底座
    var plinth = softBox(ROOM.w + 0.95, 1.05, ROOM.d + 0.95, 0.1, 0.16, M.plinth);
    plinth.position.y = -0.72;
    room.add(plinth);

    var cap = softBox(ROOM.w + 1.0, 0.1, ROOM.d + 1.0, 0.03, 0.1, M.plinthTop);
    cap.position.y = -0.185;
    room.add(cap);

    // 地板（BoxGeometry 保证 UV 正确平铺）
    var floor = new T.Mesh(new T.BoxGeometry(ROOM.w, 0.26, ROOM.d), M.floor);
    floor.position.y = -0.13;
    floor.receiveShadow = true;
    room.add(floor);

    // 地板下的木边
    var edge = new T.Mesh(new T.BoxGeometry(ROOM.w + 0.02, 0.08, ROOM.d + 0.02), M.woodDark);
    edge.position.y = -0.28;
    room.add(edge);

    // 草地环
    var gw = 0.46, gh = 0.2, gy = -0.09;
    [
      [ROOM.w + 0.94, gh, gw, 0, gy, -(HD + gw / 2)],
      [ROOM.w + 0.94, gh, gw, 0, gy, (HD + gw / 2)],
      [gw, gh, ROOM.d + 0.94, -(HW + gw / 2), gy, 0],
      [gw, gh, ROOM.d + 0.94, (HW + gw / 2), gy, 0]
    ].forEach(function (p, i) {
      var m = softBox(p[0], p[1], p[2], 0.035, 0.05, i % 2 ? M.grass : M.grassDark);
      m.position.set(p[3], p[4], p[5]);
      m.receiveShadow = true;
      room.add(m);
    });

    // 墙
    var backGeo = new T.ExtrudeGeometry(wallShape(ROOM.w + 2 * ROOM.t, ROOM.h, 0.7), {
      depth: ROOM.t, bevelEnabled: true, bevelThickness: 0.045, bevelSize: 0.045,
      bevelSegments: 2, curveSegments: 18, steps: 1
    });
    var back = new T.Mesh(backGeo, M.wall);
    back.position.set(0, 0, -HD - ROOM.t);
    back.castShadow = true;
    back.receiveShadow = true;
    room.add(back);

    var leftGeo = new T.ExtrudeGeometry(wallShape(ROOM.d + 2 * ROOM.t, ROOM.h, 0.7), {
      depth: ROOM.t, bevelEnabled: true, bevelThickness: 0.045, bevelSize: 0.045,
      bevelSegments: 2, curveSegments: 18, steps: 1
    });
    var left = new T.Mesh(leftGeo, M.wall);
    left.rotation.y = -Math.PI / 2;
    left.position.set(-HW, 0, 0);
    left.castShadow = true;
    left.receiveShadow = true;
    room.add(left);

    // 踢脚线
    var sk1 = new T.Mesh(new T.BoxGeometry(ROOM.w, 0.14, 0.05), M.trim);
    sk1.position.set(0, 0.07, -HD + 0.026);
    room.add(sk1);
    var sk2 = new T.Mesh(new T.BoxGeometry(0.05, 0.14, ROOM.d), M.trim);
    sk2.position.set(-HW + 0.026, 0.07, 0);
    room.add(sk2);

    // 墙顶描边
    var top1 = new T.Mesh(new T.BoxGeometry(ROOM.w + 0.1, 0.05, 0.06), M.trim);
    top1.position.set(0, ROOM.h - 0.03, -HD + 0.03);
    room.add(top1);
    var top2 = new T.Mesh(new T.BoxGeometry(0.06, 0.05, ROOM.d + 0.1), M.trim);
    top2.position.set(-HW + 0.03, ROOM.h - 0.03, 0);
    room.add(top2);
  })();

  /* 栅栏 */
  (function buildFence() {
    var n = 11, step = 0.33, len = n * step;
    var z = HD + 0.27, x0 = -0.2;

    for (var i = 0; i <= n; i++) {
      var post = new T.Mesh(new T.BoxGeometry(0.055, 0.44, 0.055), M.trim);
      post.position.set(x0 + i * step, 0.22, z);
      post.castShadow = true;
      room.add(post);
      var tip = new T.Mesh(new T.ConeGeometry(0.045, 0.11, 4), M.trim);
      tip.position.set(x0 + i * step, 0.49, z);
      tip.rotation.y = Math.PI / 4;
      room.add(tip);
    }
    [0.15, 0.33].forEach(function (yy) {
      var rail = new T.Mesh(new T.BoxGeometry(len, 0.038, 0.03), M.cream);
      rail.position.set(x0 + len / 2, yy, z + 0.006);
      rail.castShadow = true;
      room.add(rail);
    });
  })();

  /* 花园小花 + 灌木 */
  (function buildGarden() {
    var total = 150;
    var mesh = new T.InstancedMesh(
      new T.IcosahedronGeometry(0.04, 0),
      new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, emissive: 0xffb0c0, emissiveIntensity: 0.1 }),
      total
    );
    var dummy = new T.Object3D();
    var col = new T.Color();
    var palette = [0xffd6e0, 0xfff2d8, 0xf6b8c8, 0xffe1b0, 0xf0a8bc];
    var k = 0;

    function place(x, z) {
      if (k >= total) return;
      dummy.position.set(x, 0.055 + rand(0, 0.05), z);
      dummy.scale.setScalar(rand(0.7, 1.6));
      dummy.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      dummy.updateMatrix();
      mesh.setMatrixAt(k, dummy.matrix);
      mesh.setColorAt(k, col.setHex(pick(palette)));
      k++;
    }

    for (var i = 0; i < 120; i++) {
      var s = randInt(0, 3), t = 0;
      if (s === 0) { t = rand(-HW - 0.4, HW + 0.4); place(t, -HD - rand(0.06, 0.36)); }
      else if (s === 1) { t = rand(-HW - 0.4, HW + 0.4); place(t, HD + rand(0.06, 0.36)); }
      else if (s === 2) { t = rand(-HD - 0.4, HD + 0.4); place(-HW - rand(0.06, 0.36), t); }
      else { t = rand(-HD - 0.4, HD + 0.4); place(HW + rand(0.06, 0.36), t); }
    }

    for (var j = 0; j < 26; j++) {
      var s2 = randInt(0, 3), t2, x, z;
      if (s2 === 0) { t2 = rand(-HW, HW); x = t2; z = -HD - rand(0.1, 0.3); }
      else if (s2 === 1) { t2 = rand(-HW, HW); x = t2; z = HD + rand(0.1, 0.3); }
      else if (s2 === 2) { t2 = rand(-HD, HD); x = -HW - rand(0.1, 0.3); z = t2; }
      else { t2 = rand(-HD, HD); x = HW + rand(0.1, 0.3); z = t2; }
      var bush = new T.Mesh(new T.IcosahedronGeometry(rand(0.07, 0.12), 0), M.leafDark);
      bush.position.set(x, rand(0.02, 0.06), z);
      bush.scale.y = 0.7;
      bush.castShadow = true;
      room.add(bush);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    room.add(mesh);
  })();

  /* =======================================================================
     7. 拱窗
     ======================================================================= */
  var winObj;

  (function buildWindow() {
    var g = new T.Group();
    var W = 2.28, RH = 2.05, TH = 0.22, inset = 0.13;

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
    }), M.trim);
    frame.castShadow = true;
    frame.receiveShadow = true;
    g.add(frame);

    var glassGeo = fitUV(new T.ShapeGeometry(archShape(W - inset * 2, RH - inset), 22));
    var glass = new T.Mesh(glassGeo, new T.MeshBasicMaterial({
      map: texWindow, color: 0xffdcb8, side: T.DoubleSide
    }));
    glass.position.set(0, inset, 0.075);
    g.add(glass);

    var glow = new T.Sprite(new T.SpriteMaterial({
      map: texGlow, color: 0xffb877, transparent: true, opacity: 0.2,
      blending: T.AdditiveBlending, depthWrite: false
    }));
    glow.scale.set(5.2, 5.2, 1);
    glow.position.set(0, RH * 0.7, 0.3);
    noRaycast(glow);
    g.add(glow);

    // 窗棂
    var vb = new T.Mesh(new T.BoxGeometry(0.075, RH + innerR - inset, 0.1), M.trim);
    vb.position.set(0, inset + (RH + innerR - inset) / 2, 0.16);
    g.add(vb);
    [0.72, 1.42].forEach(function (y) {
      var hb = new T.Mesh(new T.BoxGeometry(innerR * 2, 0.065, 0.095), M.trim);
      hb.position.set(0, y, 0.16);
      g.add(hb);
    });
    var arc = new T.Mesh(new T.TorusGeometry(innerR - 0.02, 0.03, 6, 26, Math.PI), M.trim);
    arc.position.set(0, RH, 0.16);
    g.add(arc);

    // 窗台
    var sill = softBox(W + 0.46, 0.13, 0.36, 0.03, 0.05, M.cream);
    sill.position.set(0, -0.065, 0.1);
    g.add(sill);

    g.position.set(2.32, 1.05, -HD + 0.02);
    room.add(g);

    winObj = { group: g, glow: glow, glass: glass };
  })();

  /* 窗台小盆栽 + 地面窗光 */
  (function () {
    var p1 = buildPlant(0.62, 0);
    p1.position.set(1.62, 1.12, -HD + 0.42);
    room.add(p1);
    var p2 = buildPlant(0.46, 1);
    p2.position.set(3.02, 1.12, -HD + 0.4);
    room.add(p2);

    var pool = new T.Mesh(
      new T.PlaneGeometry(4.6, 3.2),
      new T.MeshBasicMaterial({
        map: texGlow, color: 0xffc48a, transparent: true, opacity: 0.2,
        blending: T.AdditiveBlending, depthWrite: false
      })
    );
    noRaycast(pool);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(2.0, 0.014, -1.7);
    room.add(pool);
    winObj.pool = pool;
  })();

  /* =======================================================================
     8. 植物
     ======================================================================= */
  function buildPlant(scale, kind) {
    var g = new T.Group();
    scale = scale || 1;

    var pot = new T.Mesh(new T.CylinderGeometry(0.2, 0.15, 0.28, 18), M.terracotta);
    pot.position.y = 0.14;
    pot.castShadow = true;
    g.add(pot);

    var soil = new T.Mesh(new T.CylinderGeometry(0.175, 0.175, 0.04, 18), M.woodDark);
    soil.position.y = 0.275;
    g.add(soil);

    var leafGeo = new T.SphereGeometry(0.5, 10, 8);
    var n = kind === 1 ? 5 : 7;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + rand(-0.3, 0.3);
      var tilt = rand(0.45, 0.9);
      var leaf = new T.Mesh(leafGeo, Math.random() > 0.45 ? M.leaf : M.leafDark);
      leaf.scale.set(0.26, 0.5, 0.075);
      var rad = rand(0.06, 0.16);
      leaf.position.set(Math.cos(a) * rad, 0.3 + rand(0.14, 0.4), Math.sin(a) * rad);
      leaf.rotation.set(tilt * Math.cos(a + 1.57) * 0.6, -a, tilt * Math.sin(a) * 0.5);
      leaf.castShadow = true;
      g.add(leaf);
    }

    var shoot = new T.Mesh(new T.ConeGeometry(0.05, 0.3, 6), M.leaf);
    shoot.position.y = 0.46;
    g.add(shoot);

    g.scale.setScalar(scale);
    return g;
  }

  /* =======================================================================
     9. 沙发
     ======================================================================= */
  var sofa;
  (function buildSofa() {
    var g = new T.Group();
    var D = 1.22, W = 2.9, seatH = 0.44;

    var base = softBox(D, seatH, W, 0.09, 0.14, M.pinkDeep);
    base.position.y = seatH / 2;
    g.add(base);

    var back = softBox(0.32, 1.02, W, 0.1, 0.15, M.pink);
    back.position.set(-D / 2 + 0.14, seatH + 0.5, 0);
    g.add(back);

    [-1, 1].forEach(function (s) {
      var arm = softBox(D * 0.98, 0.42, 0.3, 0.11, 0.14, M.pink);
      arm.position.set(0, seatH + 0.16, s * (W / 2 - 0.15));
      g.add(arm);
      var armTop = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, D * 0.98, 14), M.pink);
      armTop.rotation.z = Math.PI / 2;
      armTop.position.set(0, seatH + 0.37, s * (W / 2 - 0.15));
      armTop.castShadow = true;
      g.add(armTop);
    });

    [-1, 1].forEach(function (s) {
      var c = softBox(D - 0.36, 0.19, W / 2 - 0.19, 0.08, 0.1, M.pinkSoft);
      c.position.set(0.06, seatH + 0.07, s * (W / 4 - 0.04));
      g.add(c);
    });

    [-1, 1].forEach(function (s) {
      var p = softBox(0.18, 0.56, 0.62, 0.07, 0.1, M.pinkSoft);
      p.position.set(-D / 2 + 0.33, seatH + 0.36, s * 0.72);
      p.rotation.z = -0.16;
      g.add(p);
    });

    var pil = softBox(0.17, 0.44, 0.44, 0.07, 0.12, M.cream2);
    pil.position.set(-D / 2 + 0.44, seatH + 0.3, 1.0);
    pil.rotation.set(0.12, 0.12, -0.34);
    g.add(pil);

    var throwB = softBox(0.5, 0.07, 0.9, 0.03, 0.06, M.blush);
    throwB.position.set(0.06, seatH + 0.58, -1.1);
    throwB.rotation.z = 0.06;
    g.add(throwB);

    [[-0.45, -1.3], [-0.45, 1.3], [0.45, -1.3], [0.45, 1.3]].forEach(function (p) {
      var leg = new T.Mesh(new T.CylinderGeometry(0.05, 0.045, 0.1, 8), M.woodDark);
      leg.position.set(p[0], 0.05, p[1]);
      g.add(leg);
    });

    g.scale.setScalar(1.2);
    g.position.set(-3.3, 0, -1.3);
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    room.add(g);
    sofa = g;
  })();

  /* =======================================================================
     10. 圆茶几
     ======================================================================= */
  var tableObj;
  (function buildTable() {
    var g = new T.Group();
    var R = 1.02, topY = 0.6;

    var top = new T.Mesh(new T.CylinderGeometry(R, R, 0.1, 44), M.creamTrim);
    top.position.y = topY;
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);

    var topEdge = new T.Mesh(new T.TorusGeometry(R - 0.02, 0.04, 8, 48), M.woodLight);
    topEdge.rotation.x = Math.PI / 2;
    topEdge.position.y = topY + 0.045;
    g.add(topEdge);

    for (var i = 0; i < 4; i++) {
      var a = Math.PI / 4 + i * Math.PI / 2;
      var leg = new T.Mesh(new T.CylinderGeometry(0.06, 0.05, topY, 8), M.woodDark);
      leg.position.set(Math.cos(a) * 0.72, topY / 2, Math.sin(a) * 0.72);
      leg.rotation.set(Math.sin(a) * 0.06, 0, -Math.cos(a) * 0.06);
      leg.castShadow = true;
      g.add(leg);
    }

    var ring = new T.Mesh(new T.TorusGeometry(0.62, 0.035, 6, 40), M.wood);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.18;
    g.add(ring);

    /* 书 */
    var book = new T.Group();
    book.add(softBox(0.52, 0.045, 0.37, 0.014, 0.02, M.bookGreen));
    var pages = softBox(0.48, 0.032, 0.335, 0.008, 0.01, M.cream);
    pages.position.y = 0.037;
    book.add(pages);
    var cover2 = softBox(0.52, 0.028, 0.37, 0.01, 0.02, M.bookGreen);
    cover2.position.y = 0.062;
    book.add(cover2);
    var mark = new T.Mesh(new T.BoxGeometry(0.035, 0.12, 0.005), M.pinkDeep);
    mark.position.set(0.14, 0.06, 0.19);
    mark.rotation.x = 0.5;
    book.add(mark);
    book.position.set(0.02, topY + 0.065, -0.06);
    book.rotation.y = 0.42;
    book.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    g.add(book);

    /* 碟 + 杯子 + 蜡烛 */
    var plate = new T.Mesh(new T.CylinderGeometry(0.19, 0.185, 0.022, 26), M.white);
    plate.position.set(-0.44, topY + 0.055, 0.36);
    g.add(plate);
    var cup = new T.Mesh(new T.CylinderGeometry(0.075, 0.06, 0.1, 16), M.blush);
    cup.position.set(-0.44, topY + 0.12, 0.36);
    cup.castShadow = true;
    g.add(cup);
    var candle = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.16, 12),
      new T.MeshStandardMaterial({
        color: 0xfff2dd, roughness: 0.7, emissive: 0xffb060, emissiveIntensity: 0.5
      }));
    candle.position.set(-0.4, topY + 0.14, 0.36);
    g.add(candle);

    g.scale.setScalar(1.1);
    g.position.set(0.05, 0, -0.95);
    room.add(g);
    tableObj = { group: g, book: book };
  })();

  /* =======================================================================
     11. 睡着的猫
     ======================================================================= */
  var cat;
  (function buildCat() {
    var g = new T.Group();
    var fur = std(0xfff8ef, { roughness: 0.95 });
    var furShade = std(0xf3e6d8, { roughness: 0.95 });

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

    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.scale.setScalar(1.3);
    g.position.set(-0.95, 0.02, 0.85);
    g.rotation.y = 0.62;
    room.add(g);
    cat = g;

    var rug = new T.Mesh(new T.CircleGeometry(1.26, 48), M.rug);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-0.95, 0.008, 0.85);
    rug.receiveShadow = true;
    room.add(rug);
  })();

  /* =======================================================================
     12. 礼物盒
     ======================================================================= */
  var giftObj;
  (function buildGift() {
    var g = new T.Group();
    var W = 0.74, H = 0.6;

    var box = softBox(W, H, W, 0.03, 0.04, M.pink);
    box.position.y = H / 2;
    g.add(box);

    var ribbonMat = std(0xe9b878, {
      roughness: 0.5, metalness: 0.2,
      emissive: 0xffb873, emissiveIntensity: 0.16
    });

    var r1 = new T.Mesh(new T.BoxGeometry(0.11, H + 0.012, W + 0.012), ribbonMat);
    r1.position.set(0, H / 2, 0);
    g.add(r1);
    var r2 = new T.Mesh(new T.BoxGeometry(W + 0.012, H + 0.014, 0.11), ribbonMat);
    r2.position.set(0, H / 2, 0);
    g.add(r2);

    var lidGroup = new T.Group();
    var lid = softBox(W + 0.09, 0.13, W + 0.09, 0.03, 0.04, M.pinkSoft);
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

    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.scale.setScalar(1.1);
    g.position.set(1.78, 0, 0.72);
    g.rotation.y = 0.34;
    room.add(g);
    giftObj = { group: g, lid: lidGroup };
  })();

  /* =======================================================================
     13. 留声机
     ======================================================================= */
  var gramoObj;
  (function buildGramophone() {
    var g = new T.Group();
    var CW = 1.5, CH = 0.92, CD = 0.8;

    var cab = softBox(CW, CH, CD, 0.045, 0.05, M.wood);
    cab.position.y = CH / 2;
    g.add(cab);

    [0.28, 0.66].forEach(function (y) {
      var face = softBox(CW - 0.16, 0.3, 0.03, 0.012, 0.02, M.woodLight);
      face.position.set(0, y, CD / 2 + 0.006);
      g.add(face);
      var knob = new T.Mesh(new T.SphereGeometry(0.035, 12, 10), M.goldSoft);
      knob.position.set(0, y, CD / 2 + 0.035);
      g.add(knob);
    });

    var top = softBox(CW + 0.1, 0.07, CD + 0.1, 0.02, 0.03, M.woodLight);
    top.position.y = CH + 0.03;
    g.add(top);

    var platter = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.05, 32), M.dark);
    platter.position.set(-0.28, CH + 0.09, 0);
    g.add(platter);

    var record = new T.Mesh(new T.CylinderGeometry(0.35, 0.35, 0.012, 32),
      new T.MeshStandardMaterial({ color: 0x201d24, roughness: 0.4, metalness: 0.15 }));
    record.position.set(-0.28, CH + 0.12, 0);
    g.add(record);

    var label = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.014, 20), std(0xe8b06a, { roughness: 0.6 }));
    label.position.set(-0.28, CH + 0.126, 0);
    g.add(label);

    var arm = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 0.42, 8), M.goldSoft);
    arm.rotation.z = Math.PI / 2.3;
    arm.position.set(-0.5 + 0.08, CH + 0.2, 0.12);
    g.add(arm);

    // 喇叭
    var hornGroup = new T.Group();
    var pts = [];
    for (var i = 0; i <= 22; i++) {
      var t = i / 22;
      pts.push(new T.Vector2(0.045 + Math.pow(t, 2.6) * 0.5, t * 0.92));
    }
    var horn = new T.Mesh(new T.LatheGeometry(pts, 40),
      new T.MeshStandardMaterial({
        color: 0xf3c47e, roughness: 0.28, metalness: 0.92,
        envMapIntensity: 2.4, emissive: 0x4a3413, emissiveIntensity: 0.35,
        side: T.DoubleSide
      }));
    horn.castShadow = true;
    hornGroup.add(horn);

    var rimRing = new T.Mesh(new T.TorusGeometry(0.545, 0.028, 8, 40), M.gold);
    rimRing.rotation.x = Math.PI / 2;
    rimRing.position.y = 0.92;
    hornGroup.add(rimRing);

    var neck = new T.Mesh(new T.CylinderGeometry(0.05, 0.045, 0.3, 12), M.goldSoft);
    neck.position.y = -0.12;
    hornGroup.add(neck);

    hornGroup.position.set(-0.62, CH + 0.3, 0.04);
    hornGroup.rotation.set(0.4, 0, 0.12);
    hornGroup.scale.setScalar(1.02);
    g.add(hornGroup);

    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.scale.setScalar(1.12);
    g.position.set(-0.32, 0, -HD + 0.58);
    room.add(g);
    gramoObj = { group: g, horn: hornGroup, record: record };
  })();

  /* =======================================================================
     14. 墙面装饰
     ======================================================================= */
  (function buildWallDecor() {
    var fg = new T.Group();
    var frame = softBox(0.1, 1.36, 1.72, 0.02, 0.02, M.woodDark);
    fg.add(frame);

    var art = new T.Mesh(new T.PlaneGeometry(1.5, 1.14), M.art);
    art.position.x = 0.056;
    art.rotation.y = Math.PI / 2;
    fg.add(art);

    fg.position.set(-HW + 0.055, 3.24, -2.85);
    room.add(fg);

    var dot = new T.Mesh(new T.SphereGeometry(0.045, 10, 8),
      new T.MeshBasicMaterial({ color: 0xffd9a0 }));
    dot.position.set(-HW + 0.18, 4.04, -2.85);
    room.add(dot);

    // 置物架
    var shelf = new T.Group();
    shelf.add(softBox(0.34, 0.06, 1.5, 0.012, 0.02, M.woodLight));
    [-1, 1].forEach(function (s) {
      var br = new T.Mesh(new T.BoxGeometry(0.26, 0.16, 0.05), M.woodDark);
      br.position.set(-0.06, -0.1, s * 0.6);
      br.rotation.z = 0.5;
      shelf.add(br);
    });
    shelf.position.set(-HW + 0.17, 2.62, -1.35);
    room.add(shelf);

    var mug = new T.Mesh(new T.CylinderGeometry(0.065, 0.055, 0.11, 14), M.cream);
    mug.position.set(-HW + 0.18, 2.72, -1.78);
    room.add(mug);

    var miniBook = softBox(0.2, 0.055, 0.3, 0.01, 0.01, M.bookRed);
    miniBook.position.set(-HW + 0.18, 2.68, -1.2);
    miniBook.rotation.y = 0.2;
    room.add(miniBook);

    var tiny = buildPlant(0.5, 1);
    tiny.position.set(-HW + 0.2, 2.65, -0.78);
    room.add(tiny);
  })();

  /* =======================================================================
     15. 灯串
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
      new T.MeshStandardMaterial({ color: 0x6d5b4a, roughness: 0.9 })
    ));

    var len = curve.getLength(), step = 0.36, bulbPts = [];
    for (var d = 0.15; d < len; d += step) {
      bulbPts.push(curve.getPointAt(d / len));
    }

    var bulbMat = new T.MeshStandardMaterial({
      color: 0xfff0d4, roughness: 0.35,
      emissive: 0xffb063, emissiveIntensity: 1.4
    });
    var inst = new T.InstancedMesh(new T.SphereGeometry(0.062, 10, 8), bulbMat, bulbPts.length);
    var dummy = new T.Object3D();
    bulbPts.forEach(function (p, i) {
      dummy.position.set(p.x, p.y - 0.045, p.z);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    g.add(inst);

    var pos = new Float32Array(bulbPts.length * 3);
    bulbPts.forEach(function (p, i) {
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y - 0.045; pos[i * 3 + 2] = p.z;
    });
    var pg = new T.BufferGeometry();
    pg.setAttribute('position', new T.BufferAttribute(pos, 3));
    var pm = new T.PointsMaterial({
      map: texGlow, color: 0xffbb77, size: 0.85, sizeAttenuation: true,
      transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false
    });
    var clouds = new T.Points(pg, pm);
    noRaycast(clouds);
    g.add(clouds);

    room.add(g);
    lightStrings.push({ mat: bulbMat, glow: pm, delay: delay || 0, base: 2.0 });
    return g;
  }

  buildStringLights(
    new T.Vector3(-HW + 0.12, 4.78, -HD + 0.12),
    new T.Vector3(HW - 0.08, 4.78, -HD + 0.12),
    4, 0.3, 0
  );
  buildStringLights(
    new T.Vector3(-HW + 0.1, 4.78, -HD + 0.14),
    new T.Vector3(-HW + 0.1, 4.78, HD - 1.3),
    3, 0.26, 0.45
  );

  /* =======================================================================
     16. 纸灯笼
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
    lanterns.push({
      g: g, halo: halo, haloSize: haloSize, ball: ball,
      baseY: y, phase: rand(0, 6.28), spd: rand(0.45, 0.75)
    });
    return g;
  }

  buildLantern(1.55, 3.7, -1.2, 0.33);
  buildLantern(-1.5, 4.15, -2.45, 0.23);
  buildLantern(-2.32, 3.15, 1.4, 0.27);

  /* =======================================================================
     17. 花 / 角落小物
     ======================================================================= */
  var vase;
  (function buildVase() {
    var g = new T.Group();
    var profile = [];
    [[0, 0], [0.16, 0], [0.19, 0.1], [0.12, 0.34], [0.09, 0.44], [0.13, 0.5], [0.12, 0.52]]
      .forEach(function (p) { profile.push(new T.Vector2(p[0], p[1])); });

    var v = new T.Mesh(new T.LatheGeometry(profile, 24), M.cream);
    v.castShadow = true;
    g.add(v);

    var bloomMats = [
      std(0xf7c1c8, { roughness: 0.85, emissive: 0xff9aa8, emissiveIntensity: 0.06 }),
      std(0xfff0dd, { roughness: 0.9 }),
      std(0xf3a9b4, { roughness: 0.85 })
    ];

    for (var i = 0; i < 6; i++) {
      var a = (i / 6) * Math.PI * 2 + rand(-0.4, 0.4);
      var hh = rand(0.42, 0.72);
      var lean = rand(0.1, 0.3);
      var stem = new T.Mesh(new T.CylinderGeometry(0.012, 0.014, hh, 5), M.leafDark);
      stem.position.set(Math.cos(a) * lean * 0.6, 0.5 + hh / 2, Math.sin(a) * lean * 0.6);
      stem.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean);
      g.add(stem);

      var bloom = new T.Mesh(new T.IcosahedronGeometry(rand(0.07, 0.1), 0), pick(bloomMats));
      bloom.position.set(Math.cos(a) * lean, 0.5 + hh, Math.sin(a) * lean);
      bloom.scale.set(1, 0.8, 1);
      bloom.castShadow = true;
      g.add(bloom);
    }

    for (var j = 0; j < 4; j++) {
      var ang = rand(0, 6.28);
      var lf = new T.Mesh(new T.SphereGeometry(0.5, 8, 6), M.leaf);
      lf.scale.set(0.14, 0.05, 0.28);
      lf.position.set(Math.cos(ang) * 0.2, 0.62, Math.sin(ang) * 0.2);
      lf.rotation.set(0.3, ang, 0.5);
      g.add(lf);
    }

    g.scale.setScalar(1.1);
    g.position.set(3.02, 0, -0.52);
    room.add(g);
    vase = g;
  })();

  (function buildProps() {
    var crate = softBox(0.62, 0.44, 0.62, 0.03, 0.03, M.woodLight);
    crate.position.set(-3.3, 0.22, 1.05);
    crate.rotation.y = 0.3;
    room.add(crate);

    var crateEdge = new T.Mesh(new T.BoxGeometry(0.64, 0.05, 0.64), M.woodDark);
    crateEdge.position.set(-3.3, 0.44, 1.05);
    crateEdge.rotation.y = 0.3;
    room.add(crateEdge);

    var p = buildPlant(0.55, 1);
    p.position.set(-3.3, 0.46, 1.05);
    room.add(p);

    var colors = [M.bookRed, M.bookGreen, M.cream];
    for (var i = 0; i < 3; i++) {
      var b = softBox(0.44 - i * 0.03, 0.045, 0.32, 0.008, 0.01, colors[i % 3]);
      b.position.set(-2.95, 0.03 + i * 0.05, 2.0);
      b.rotation.y = 0.2 + i * 0.12;
      room.add(b);
    }

    /* 小圆边几 */
    var side = new T.Group();
    var stop = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 0.09, 26), M.woodLight);
    stop.position.y = 0.44;
    stop.castShadow = true;
    stop.receiveShadow = true;
    side.add(stop);
    for (var q = 0; q < 3; q++) {
      var qa = q * Math.PI * 2 / 3 + 0.4;
      var sl = new T.Mesh(new T.CylinderGeometry(0.032, 0.028, 0.44, 7), M.woodDark);
      sl.position.set(Math.cos(qa) * 0.27, 0.22, Math.sin(qa) * 0.27);
      sl.rotation.set(Math.sin(qa) * 0.08, 0, -Math.cos(qa) * 0.08);
      sl.castShadow = true;
      side.add(sl);
    }
    var scup = new T.Mesh(new T.CylinderGeometry(0.085, 0.07, 0.11, 16), M.cream2);
    scup.position.set(0.06, 0.54, -0.04);
    scup.castShadow = true;
    side.add(scup);
    side.position.set(2.55, 0, 1.85);
    room.add(side);

    /* 地垫 */
    var cushion = softBox(0.86, 0.17, 0.86, 0.05, 0.12, M.cream2);
    cushion.position.set(-1.42, 0.09, 2.42);
    cushion.rotation.y = 0.28;
    room.add(cushion);
    var btn = new T.Mesh(new T.SphereGeometry(0.045, 10, 8), M.blush);
    btn.position.set(-1.42, 0.175, 2.42);
    room.add(btn);

    /* 拖鞋 */
    [-1, 1].forEach(function (sd) {
      var sl2 = new T.Mesh(new T.SphereGeometry(0.16, 14, 10), M.pinkSoft);
      sl2.scale.set(1.5, 0.42, 0.85);
      sl2.position.set(-2.02 + sd * 0.02, 0.055, 1.9 + sd * 0.19);
      sl2.rotation.y = 0.2 + sd * 0.08;
      sl2.castShadow = true;
      room.add(sl2);
    });

    [[3.35, -2.55, 1.0], [3.28, 2.42, 0.85], [-3.62, 2.62, 1.25]].forEach(function (p2) {
      var pl = buildPlant(p2[2], 0);
      pl.position.set(p2[0], 0, p2[1]);
      room.add(pl);
    });
  })();

  /* 接触阴影（让家具"落地"） */
  (function contactShadows() {
    function contact(x, z, sx, sz, op) {
      var m = new T.Mesh(new T.PlaneGeometry(sx, sz), new T.MeshBasicMaterial({
        map: texAO, transparent: true, opacity: op, depthWrite: false
      }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.006, z);
      noRaycast(m);
      room.add(m);
      return m;
    }
    contact(-3.3, -1.3, 2.7, 4.0, 0.42);
    contact(0.05, -0.95, 2.9, 2.9, 0.36);
    contact(-0.32, -3.5, 2.1, 1.4, 0.4);
    contact(1.78, 0.72, 1.3, 1.3, 0.34);
    contact(2.55, 1.85, 1.1, 1.1, 0.3);
    contact(-1.42, 2.42, 1.2, 1.2, 0.26);
    contact(3.02, -0.52, 0.95, 0.95, 0.28);
    contact(-3.3, 1.05, 1.1, 1.1, 0.3);
  })();

  /* =======================================================================
     18. 星空 / 尘埃
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
      var r = rand(58, 96);
      var s = Math.sqrt(1 - u * u);
      pos[i * 3] = r * s * Math.cos(theta);
      pos[i * 3 + 1] = r * u * 0.75 + 8;
      pos[i * 3 + 2] = r * s * Math.sin(theta);

      var warm = Math.random();
      c.setHSL(warm > 0.72 ? 0.09 : 0.62, warm > 0.72 ? 0.42 : 0.22, rand(0.62, 0.95));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }

    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.BufferAttribute(col, 3));

    starField = new T.Points(geo, new T.PointsMaterial({
      map: texStar, size: 1.0, sizeAttenuation: true, vertexColors: true,
      transparent: true, opacity: 0.9, depthWrite: false,
      blending: T.AdditiveBlending
    }));
    noRaycast(starField);
    scene.add(starField);

    for (var j = 0; j < 14; j++) {
      var sp = new T.Sprite(new T.SpriteMaterial({
        map: texStar, color: Math.random() > 0.7 ? 0xffd9a0 : 0xdfe6ff,
        transparent: true, opacity: rand(0.3, 0.75),
        blending: T.AdditiveBlending, depthWrite: false
      }));
      var u2 = Math.random() * 0.6 + 0.15;
      var th2 = rand(0, 6.28);
      var r2 = rand(52, 70);
      var s2 = Math.sqrt(1 - u2 * u2);
      sp.position.set(r2 * s2 * Math.cos(th2), r2 * u2 * 0.8 + 10, r2 * s2 * Math.sin(th2));
      sp.scale.setScalar(rand(1.4, 3.4));
      sp.userData.tw = rand(0.5, 1.6);
      noRaycast(sp);
      scene.add(sp);
      bigStars.push(sp);
    }
  })();

  var dust;
  (function buildDust() {
    var n = 120;
    var pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      pos[i * 3] = rand(-HW + 0.3, HW - 0.3);
      pos[i * 3 + 1] = rand(0.3, 4.8);
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
     19. 可交互物件注册
     ======================================================================= */
  var pickables = [];
  var itemById = {};

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
      id: id,
      name: cfg.name,
      text: cfg.text,
      found: false,
      hover: 1,
      react: extra && extra.react ? extra.react : null
    };

    pickables.push(wrap);
    itemById[id] = wrap;
    return wrap;
  }

  register(sofa, 'sofa');
  register(gramoObj.group, 'gramo', {
    react: function () {
      gramoObj.record.userData.spin = 1;
      tween(gramoObj.horn.rotation, 'x', 0.26, 1.2, 0.1);
      Sound.chime(true);
    }
  });
  register(cat, 'cat', {
    react: function () { cat.userData.stretch = 1; Sound.purr(); }
  });
  register(giftObj.group, 'gift', {
    react: function () { giftObj.lid.userData.open = 1; Sound.chime(); }
  });
  register(winObj.group, 'window', {
    react: function () {
      winObj.glow.userData.pulse = 1;
      tween(windowLight, 'intensity', 1.8, 1.1, 0.05);
      Sound.chime(true);
    }
  });
  register(tableObj.book, 'book', {
    react: function () {
      tween(tableObj.book.rotation, 'y', tableObj.book.rotation.y + 0.55, 0.7, 0.05);
      Sound.page();
    }
  });
  register(vase, 'flower', {
    react: function () { bounce(vase, 0.05); Sound.chime(); }
  });

  (function registerLights() {
    var hit = new T.Mesh(
      new T.BoxGeometry(ROOM.w - 0.8, 1.1, 0.34),
      new T.MeshBasicMaterial({ visible: false })
    );
    hit.position.set(0, 4.55, -HD + 0.22);
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

  /* 补间 / 弹跳 */
  var tweens = [];
  function tween(obj, keyName, to, dur, delay) {
    tweens.push({ obj: obj, key: keyName, from: obj[keyName], to: to, t: -(delay || 0), dur: dur || 0.6 });
  }
  function bounce(obj, amt) {
    obj.userData.__bounce = 1;
    obj.userData.__bounceAmt = amt;
  }

  /* =======================================================================
     20. 相机控制
     ======================================================================= */
  var cam = {
    cTheta: 1.2, cPhi: 0.6, cR: 46,
    tTheta: 0.8, tPhi: 1.0, tR: 26,
    minR: 15, maxR: 52,
    minPhi: 0.4, maxPhi: 1.34,
    minTheta: 0.1, maxTheta: 1.5
  };
  var introT = 0;
  var swayT = 0, idleT = 99;

  function fitCamera() {
    var w = pane.clientWidth || 1;
    var h = pane.clientHeight || 1;
    var aspect = w / h;
    camera.aspect = aspect;

    var fov = aspect < 1 ? 40 : (aspect < 1.35 ? 34 : 30);
    camera.fov = fov;
    camera.updateProjectionMatrix();

    var R = CONFIG.camera.fitRadius;
    var vHalf = T.MathUtils.degToRad(fov) / 2;
    var hHalf = Math.atan(Math.tan(vHalf) * aspect);
    var need = Math.max(R / Math.sin(vHalf), R / Math.sin(hHalf)) * 0.94;

    cam.tR = clamp(need, cam.minR, cam.maxR);
    cam.maxR = Math.max(52, cam.tR * 1.8);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
  }

  function applyCamera(dt) {
    var damp = introT < 2.4 ? 2.2 : 9;
    var k = 1 - Math.exp(-damp * dt);
    cam.cTheta += (cam.tTheta - cam.cTheta) * k;
    cam.cPhi += (cam.tPhi - cam.cPhi) * k;
    cam.cR += (cam.tR - cam.cR) * k;

    var swayAmp = clamp((idleT - 1.2) / 2.5, 0, 1) * 0.022;
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
      drag.active = true;
      drag.moved = 0;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
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
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);

      cam.tTheta = clamp(cam.tTheta - dx * 0.0062, cam.minTheta, cam.maxTheta);
      cam.tPhi = clamp(cam.tPhi - dy * 0.0048, cam.minPhi, cam.maxPhi);
      cam.cTheta = cam.tTheta;
      cam.cPhi = cam.tPhi;
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
      drag.active = false;
      drag.pinch = 0;
    } else if (pointers.size === 1) {
      var rest = Array.from(pointers.values())[0];
      drag.lastX = rest.x;
      drag.lastY = rest.y;
      drag.active = true;
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', function () {
    pointers.clear();
    drag.active = false;
    hasPointer = false;
    hideTooltip();
  });
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    cam.tR = clamp(cam.tR * (1 + e.deltaY * 0.00085), cam.minR, cam.maxR);
    idleT = 0;
  }, { passive: false });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* =======================================================================
     21. 拾取 / 悬停
     ======================================================================= */
  var raycaster = new T.Raycaster();
  var hovered = null;
  var tooltipEl = document.getElementById('tooltip');
  var tooltipName = document.getElementById('tooltip-name');

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
      if (hit) {
        canvas.classList.add('pointing');
        showTooltip(hit);
      } else {
        canvas.classList.remove('pointing');
        hideTooltip();
      }
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
     22. 惊喜
     ======================================================================= */
  var found = 0;
  var dotsEl = document.getElementById('dots');
  var countEl = document.getElementById('count');
  var toastEl = document.getElementById('toast');
  var toastName = document.getElementById('toast-name');
  var toastText = document.getElementById('toast-text');
  var toastTimer = null;

  CONFIG.items.forEach(function () {
    dotsEl.appendChild(document.createElement('i'));
  });

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

  function triggerItem(target) {
    var d = target.userData;

    bounce(target, 0.05);
    spawnSparks(worldPos(target), d.found ? 0xffd9a0 : 0xffc98a, d.found ? 6 : 16);
    if (d.react) { try { d.react(); } catch (err) {} }

    showToast(d.name, d.text);

    if (!d.found) {
      d.found = true;
      found++;
      updateProgress();
      if (found >= CONFIG.items.length) setTimeout(finale, 1300);
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
     23. 终章
     ======================================================================= */
  var finaleEl = document.getElementById('finale');

  function finale() {
    finaleEl.classList.add('show');
    finaleEl.setAttribute('aria-hidden', 'false');
    spawnSparks(new T.Vector3(0, 3, 0), 0xffd9a0, 40);
    [
      new T.Vector3(-3, 2.4, 0),
      new T.Vector3(3, 2.4, 0),
      new T.Vector3(0, 4.4, -2),
      new T.Vector3(0, 4.2, 2)
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
    gramoObj.horn.rotation.x = 0.4;
    gramoObj.record.userData.spin = 0;
    cam.tTheta = 0.8;
    cam.tPhi = 1.0;
  });

  /* =======================================================================
     24. 声音（WebAudio 实时合成）
     ======================================================================= */
  var Sound = (function () {
    var ctx = null, master = null, on = false, padTimer = null, pluckTimer = null;
    var chordIdx = 0;
    var chords = [
      [174.61, 261.63, 329.63, 392.00],
      [130.81, 196.00, 261.63, 329.63],
      [146.83, 220.00, 293.66, 349.23],
      [110.00, 164.81, 261.63, 329.63]
    ];
    var scale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];

    function ensure() {
      if (ctx) return true;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);
      } catch (e) {
        ctx = null;
        return false;
      }
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
        lp.type = 'lowpass';
        lp.frequency.value = 900;
        lp.Q.value = 0.4;

        o.connect(g); g.connect(lp); lp.connect(master);
        o.start(now);
        o.stop(now + dur + 0.2);
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
      lp.type = 'lowpass';
      lp.frequency.value = 2600;
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
          pluckTimer = setInterval(function () {
            if (Math.random() > 0.35) pluck();
          }, 2600);
        }
        var btn = document.getElementById('btn-sound');
        btn.classList.add('is-on');
        btn.setAttribute('aria-pressed', 'true');
        document.getElementById('sound-label').textContent = '声音 · 开';
      },
      disable: function () {
        on = false;
        if (ctx) {
          master.gain.cancelScheduledValues(ctx.currentTime);
          master.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
        }
        var btn = document.getElementById('btn-sound');
        btn.classList.remove('is-on');
        btn.setAttribute('aria-pressed', 'false');
        document.getElementById('sound-label').textContent = '声音 · 关';
      },
      toggle: function () { on ? Sound.disable() : Sound.enable(); },
      chime: function (big) { blip(big ? [880, 1174.66] : [659.25, 987.77], 0.09, 0.9); },
      page: function () { blip([420, 380], 0.05, 0.35); },
      purr: function () { blip([110, 138], 0.045, 0.7); }
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
    cam.tTheta = 0.8;
    cam.tPhi = 1.0;
    fitCamera();
    idleT = 0;
  });

  /* =======================================================================
     25. 动画
     ======================================================================= */
  var clock = new T.Clock();
  var elapsed = 0;
  var started = false;
  var veil = document.getElementById('veil');
  var sceneHint = document.getElementById('scene-hint');
  var hoverTick = 0;

  window.addEventListener('resize', fitCamera);
  window.addEventListener('orientationchange', function () {
    setTimeout(fitCamera, 260);
  });

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
      var target = ls.base * t0 + flashLights * 1.5;
      ls.mat.emissiveIntensity = lerp(ls.mat.emissiveIntensity, target, 1 - Math.exp(-6 * dt));
      ls.glow.opacity = lerp(ls.glow.opacity, t0 * 0.72, 1 - Math.exp(-5 * dt));
    }
    flashLights = Math.max(0, flashLights - dt * 1.2);

    /* 灯笼 */
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
      if (winObj.pool) {
        winObj.pool.material.opacity = 0.17 + Math.sin(elapsed * 0.9) * 0.03 + wp * 0.16;
      }
    }

    /* 猫呼吸 */
    if (cat) {
      var breathe = 1 + Math.sin(elapsed * 1.05) * 0.018;
      var st = cat.userData.stretch || 0;
      var k2 = st > 0 ? Math.sin(st * Math.PI) * 0.14 : 0;
      cat.scale.set(1.3, 1.3 * breathe * (1 - k2 * 0.5), 1.3 * (1 + k2));
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
      var want = (hovered === p) ? 1.032 : 1;
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
        if (y > 4.9) y = 0.2;
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
  cam.cTheta = 1.22;
  cam.cPhi = 0.6;
  cam.cR = cam.maxR;
  cam.tTheta = 0.8;
  cam.tPhi = 1.0;
  camera.position.set(20, 36, 40);
  animate();

  canvas.addEventListener('dblclick', function (e) { e.preventDefault(); });

  /* 调试钩子（不影响界面，仅供自动化测试 / 控制台调试使用） */
  window.__starlight = {
    items: itemById,
    trigger: function (id) { if (itemById[id]) triggerItem(itemById[id]); },
    finale: finale,
    count: function () { return found; }
  };

})();
