# 星光阁楼 · Starlight Attic

一个**完全离线、零外部素材**的 3D 可交互阁楼网站。整页只有一块全屏 3D 舞台（没有顶部文字栏、没有左右分栏），用 [three.js](https://threejs.org/) 程序化生成全部几何体与贴图：琥珀色木墙、石块墙、满墙梵高风厚框画、交叉木格栅楼梯与阁楼、串灯与藤蔓、龟背竹与向日葵、橙色沙发、唱片机、蜷着的小猫。可旋转 / 缩放，点击 8 个物件解锁文案，集齐触发终章。

## 在线预览

部署在 GitHub Pages，仓库根目录即站点入口：
<https://yw-iris.github.io/starlight-cabin/>

![预览](preview.png)

## 本地运行

直接用浏览器打开 `index.html` 即可，无需联网、无需构建。

```bash
# 任选其一
open index.html                 # macOS
xdg-open index.html             # Linux
start index.html                # Windows
```

## 文件结构

| 文件 | 作用 |
| --- | --- |
| `index.html` | 页面入口（全屏 3D 舞台 + 浮动 HUD） |
| `app.js` | 场景、建模、灯光、交互、WebAudio 实时音效 |
| `styles.css` | 暖琥珀主题、玻璃质感 HUD、响应式 |
| `vendor/three.min.js` | 本地内置 three.js r0.149 |

## 内饰要点

- **墙面**：琥珀色木板墙（程序化木纹 + 结疤 + 明暗渐变）+ 左侧石块墙，墙脚压边与顶部横梁
- **画廊**：13 幅厚橙框油画，3 行 5 列整齐排布，画心用 `emissiveMap` 自发光，画面在暗处也有内透感
- **楼梯**：右侧实体踏步 + 沿坡度的交叉木格栅栏板 + 起步柱 / 收头柱，台阶上摆小盆栽
- **阁楼**：木板平台、前缘收边、双向格栅护栏，平台上靠墙斜放两幅画
- **软装**：橙色双人沙发、圆木几、唱片机（点击转盘转动、喇叭微抬）、向日葵地垫、地毯、书堆、礼盒、拖鞋、光球壁灯
- **光氛围**：暖橙半球光 + 顶光 + 窗光 + 画廊灯 + 阁楼灯，ACES 色调映射，地板中心一层柔和暖光晕
- **植物**：龟背竹、向日葵、多肉小盆栽、藤蔓串灯

## 交互

- 拖拽旋转 · 滚轮 / 双指缩放 · 松手后轻微呼吸式漂移
- 点击：沙发、唱片机、小猫、礼盒、窗、书、花、串灯（悬停有高亮与提示）
- 集齐 8/8 触发终章，可重玩
- 右下角可静音 / 重置视角

## 技术说明

- three.js r0.149（UMD，本地引入，离线可用）
- 关闭 `ColorManagement.legacyMode`，十六进制颜色按 sRGB 解释后转线性，避免整体发灰发白
- `MeshStandardMaterial` + `PMREMGenerator` 环境贴图 + ACES 色调映射 + `PCFSoftShadowMap`
- `CanvasTexture` 程序化生成木纹 / 石纹 / 地板 / 地毯 / 夜空 / 10 种手绘油画
- `ExtrudeGeometry` 圆角体、拱形墙、六边形壁龛；`LatheGeometry` 做留声机喇叭
- `InstancedMesh` 花丛与灯泡、`Sprite` 光晕、`Points` 星空与浮尘
- WebAudio API 实时合成氛围 pad、拨弦、铃音、翻页声与猫呼噜

> 内饰参考了一组《光·遇》风格的阁楼截图：暖橙木墙、厚橙画框、交叉格栅、串灯藤蔓与向日葵。
