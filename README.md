# RockRat  岩鼠：舒舒服服做科研 
![](https://github.com/deng113jie/rockrat/blob/master/icon/rockrat.png)

A web-based IDE for orchestrating AI-driven research pipelines using Claude Code agents.

![RockRat Main UI](https://github.com/deng113jie/rockrat/blob/master/front_ui.png) 

## Getting Started

### 1. Install Node.js

Download and install Node.js (v18 or later) from [nodejs.org](https://nodejs.org).

Verify the installation using bash or cmd (Windows: 开始，搜索/输入 cmd ， 点击“命令提示符”):

```bash
node -v
npm -v
```


### 2. Install Claude Code

Windows下需要提前安装git https://git-scm.com/install/windows
```bash
npm install -g @anthropic-ai/claude-code
```

关闭cmd，再重新打开，输入
```bash
claude
```
测试是否安装成功。成功后直接关闭cmd窗口即可。

### 3. Install dependencies

如果是cmd界面，需要先cd到项目目录。例如：cd C:\Users\abc\Document\code\research-agent-ui

然后输入：

```bash
npm install
```

安装相关依赖包This installs Express, Multer, and the Claude Agent SDK.

### 3. Set your Anthropic API key

The agent feature requires an Anthropic API key. 

在.env文件中包含了一个测试API，但请求数有限制。

因此测试时这步可以略过。如需长期使用，请自行购买claude token api，或联系我（wx:wayfull001）


```bash
export ANTHROPIC_API_KEY=your_api_key_here
```

### 4. Start the server

```bash
node server.js
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

> **Note:** Always use `http://localhost:3000` — opening `index.html` directly in the browser (e.g. via a file:// URL or an IDE preview server) will break the paper list and agent features, which require the Express backend.

## Features

- **知识库 (Knowledge Base)** — reads PDF files from the local `./papers` directory; supports upload via drag-and-drop or file picker
- **开始调研 (Start Research)** — select papers and click this button to run a Claude Code agent that analyses the selected files and streams results back live
- **Pipeline** — visual node graph for orchestrating multi-stage research workflows (literature review → experiments → paper writing → review)
- **Review** — approval ledger and reviewer notes

## Project Structure

```
research-agent-ui/
├── index.html    # UI layout
├── app.js        # Frontend interactions
├── styles.css    # Design system
├── server.js     # Express backend (file API + agent endpoint)
└── papers/       # Drop your PDF papers here
```


## 使用时注意

- 如果需要agent自动使用IEEE Xplore，请1)安装chrome, 2) 在chrome中输入 chrome://inspect/#remote-debugging  启用远程调试， 3）打开IEEE Xplore并登录
- 有任何问题，可以联系（wx:wayfull001）