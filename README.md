# 星光小屋 · Starlight Cabin

一个**完全离线、零外部素材**的 3D 可交互小屋网站。用 [three.js](https://threejs.org/) 程序化生成全部几何体与材质（陶土墙、橡木地板、粉沙发、睡猫、留声机、拱形夜景窗、串灯、纸灯笼、花园花丛），可旋转 / 缩放，点击 8 个物件解锁走心文案，集齐触发终章。

## 在线预览
部署在 GitHub Pages，仓库根目录即站点入口。

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
| `index.html` | 页面入口（左文案 / 右 3D 场景 分栏） |
| `app.js` | 场景、建模、灯光、交互、WebAudio 实时音效 |
| `styles.css` | 暗夜暖色主题与响应式布局 |
| `vendor/three.min.js` | 本地内置 three.js r0.149 |

## 交互
- 拖拽旋转 · 滚轮 / 双指缩放
- 点击：沙发、留声机、小猫、礼盒、窗、书、花、串灯
- 集齐 8/8 触发终章，可重玩
- 左下角可静音 / 重置

## 技术说明
- three.js r0.149（UMD，本地引入，离线可用）
- `MeshStandardMaterial` + `PMREMGenerator` 环境光 + ACES 色调映射 + 软阴影
- `CanvasTexture` 程序化木纹 / 墙漆 / 夜景 / 地毯 / 星火贴图
- WebAudio API 实时合成氛围 pad、拨弦、铃音

> 灵感来自一段等距小屋视频，复刻为可交互的浪漫礼物体验。
