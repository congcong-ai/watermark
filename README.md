# 批量图片水印工具

一个纯前端的批量图片加水印工具，支持在浏览器本地处理图片并打包下载。

## 功能特点

- 🖼️ **批量处理**：支持选择多张图片或整个目录（保持目录结构）
- 🎨 **自定义水印**：可调文本、颜色、透明度、字号、位置、旋转角度
- 🌐 **纯前端**：所有处理在浏览器本地完成，图片不上传服务器
- 📦 **打包下载**：处理完成后自动打包为 ZIP 并下载
- 🚀 **高性能**：使用 Canvas API，可支持大图处理

## 项目结构

```
watermark/
├── web/                 # Next.js 前端应用
│   ├── app/            # 页面组件
│   ├── .env            # 环境变量配置
│   ├── package.json    # 依赖管理
│   └── README.md       # 前端说明
├── pictures/           # 示例图片
├── watermark.py        # Python 版本（可选）
├── requirements.txt    # Python 依赖
└── README.md          # 项目说明
```

## 快速开始

### Web 版本（推荐）

1. **安装依赖**
   ```bash
   cd web
   npm install
   ```

2. **启动开发服务器**
   ```bash
   npm run dev:kill  # 先杀 3000 端口再启动
   ```

3. **访问应用**
   打开 http://localhost:3000

4. **构建生产版本**
   ```bash
   npm run build
   npm run start:kill  # 先杀 3000 端口再启动
   ```

### Python 版本（可选）

```bash
pip install -r requirements.txt
python watermark.py
```

## 使用说明

1. **上传图片**
   - 点击"选择多张图片"按钮选择文件
   - 点击文件夹图标选择整个目录
   - 或直接拖拽图片/目录到上传区域

2. **设置水印参数**
   - 文本：水印文字内容
   - 颜色：水印颜色
   - 透明度：0-1 之间的数值
   - 字号：水印文字大小
   - 位置：平铺/居中/左上/右下
   - 旋转：水印旋转角度（-90° 到 90°）

3. **处理并下载**
   - 点击"添加水印并下载 ZIP"
   - 等待处理完成
   - 自动下载包含处理后图片的 ZIP 文件

## 环境变量配置

Web 版本支持通过 `.env` 文件配置默认参数：

```env
NEXT_PUBLIC_APP_TITLE="给图片加水印"
NEXT_PUBLIC_DEFAULT_WATERMARK_TEXT="仅用于学习测试"
NEXT_PUBLIC_DEFAULT_COLOR="#ffffff"
NEXT_PUBLIC_DEFAULT_OPACITY="0.25"
NEXT_PUBLIC_DEFAULT_FONT_SIZE="24"
NEXT_PUBLIC_DEFAULT_POSITION="tile"
NEXT_PUBLIC_DEFAULT_ROTATE="-30"
```

## 部署到 Vercel

### 方式一：Vercel Dashboard

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 "New Project"
3. 导入 GitHub 仓库 `congcong-ai/watermark`
4. 设置 **Root Directory** 为 `web`
5. 在 **Environment Variables** 中添加上述 `NEXT_PUBLIC_*` 变量
6. 点击 **Deploy**

### 方式二：Vercel CLI

```bash
# 安装并登录
npm i -g vercel
vercel login

# 在 web 目录下部署
cd web
vercel --prod

# 配置环境变量（可选）
vercel env add NEXT_PUBLIC_APP_TITLE production
# ... 添加其他变量
```

## 支持的格式

- **输入格式**：PNG、JPG、JPEG、WEBP、BMP 等浏览器支持的图片格式
- **输出格式**：保持与原图一致，JPG 使用 0.92 质量

## 技术栈

- **前端**：Next.js 14、React、TypeScript、Tailwind CSS
- **图片处理**：Canvas API、JSZip
- **部署**：Vercel

## 注意事项

- 🔄 **浏览器兼容性**：推荐使用 Chrome/Edge，Safari/Firefox 可能不支持拖拽目录
- 💾 **内存使用**：批量处理大图时会占用较多内存，建议分批处理
- 🔒 **隐私安全**：所有处理在本地完成，不会上传任何图片到服务器
- 📁 **目录结构**：输出的 ZIP 文件会保持原始目录结构

## 开发

```bash
# 开发模式
cd web
npm run dev:kill

# 类型检查
npm run build

# 代码检查
npm run lint
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v1.0.0
- 初始版本发布
- 支持批量图片水印处理
- 支持自定义水印参数
- 支持目录拖拽上传
- 部署到 Vercel
