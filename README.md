# 🔧 KlikkFix – AI-Powered Text Enhancement in Your Browser

KlikkFix is a smart, lightweight, and intuitive browser extension that lets you enhance, rephrase, or professionalize text directly in your browser — all with a single right-click. It seamlessly replaces selected text with AI-enhanced versions, with zero distractions and full control.

---

## 🚀 Features

- ✨ **Right-Click AI Actions** – Select text, right-click, and instantly improve it using advanced AI (OpenAI API).
- ✅ **In-place Replacement** – AI-generated results replace the original selected content without switching tabs or opening UIs.
- ⌨️ **Keyboard Shortcuts** – Trigger AI actions directly from your keyboard.
- 🌐 **Use Anywhere** – Works in Gmail, Google Docs, LinkedIn, Notion, and more.
- 🔐 **Secure OAuth Login** – Supports Google, GitHub, and Microsoft logins.
- 🧠 **Modular Tool System** – Rewrite, Translate, Summarize, Fix grammar, and more.
- 💳 **Stripe-Based Plan Management** – Free and paid tiers with dynamic tool access.
- 📋 **Auto Copy & Toast UI** – View results in a minimal toast or auto-copy to clipboard.
- 🖥️ **Planned Desktop App** – Extend KlikkFix system-wide for any native app.
- 🧩 **Offline Mode (Premium)** – Local model execution and metadata indexing (in progress).

---

## 🗭 How It Works

1. Highlight the text you want to improve.
2. Right-click and choose **"Enhance with KlikkFix"** or press your configured shortcut.
3. The AI instantly returns the improved version — which can be auto-replaced in place, shown in a toast, or copied to your clipboard.

> "It has never been this frictionless to use AI in-browser. Just select, right-click, and act."

---

## 🛠 Technical Overview

- **Manifest:** V3
- **Frontend:** Vanilla JavaScript, HTML, CSS
- **Backend:** Python (Flask), Render-hosted
- **AI:** OpenAI API, DeepSeek, local LLM support planned
- **Storage:** Chrome Local Storage & PostgreSQL sync
- **Authentication:** Google, GitHub, Microsoft via OAuth2
- **Payments:** Stripe Checkout with Webhooks

---

## 🔐 Permissions

| Permission       | Purpose                                       |
| ---------------- | --------------------------------------------- |
| `contextMenus`   | Show right-click options                      |
| `scripting`      | Replace selected text in DOM                  |
| `activeTab`      | Work with current tab and content             |
| `storage`        | Save tools, settings, and plan data           |
| `identity`       | OAuth login without custom auth               |
| `tabs`           | Sync content access and inject scripts        |
| `cookies`        | Maintain login session across backends        |

---

## 🔒 Privacy

KlikkFix does not store your text, AI prompts, or results unless you explicitly choose to. All interactions are stateless, and offline mode will allow full local control. 

See [privacy.html](./privacy.html) for more.

---

## 💳 Pricing Plans

| Plan        | Price         | Details                                                 |
| ----------- | ------------- | ------------------------------------------------------- |
| **Basic**   | Free          | Limited tools, 1 month usage, no customization          |
| **Pro**     | \$9.99/month  | Full tools, keyboard shortcuts, customization, sync     |
| **Premium** | \$14.99/month | Offline mode, fast queue, MagicalClick, advanced models |

---

## 📷 Screenshots & Demo

Visit [klikkfix.com](https://klikkfix.com) for:
- Screenshots
- Live demo
- Feature breakdown
- Download link
- Pricing & support

---

## 🧠 Usage Tips

- Highlight full sentences for optimal results
- Configure tools and shortcuts from the popup UI
- Works best in Gmail, Notion, Docs, and professional platforms

---

## 📩 Support & Feedback

- 🌐 Website: [KlikkFix](https://klikkfix.com)
- 📧 Email: [support@klikkfix.com](mailto:support@klikkfix.com)
- 🐙 GitHub: [github.com/yourusername/klikkfix](https://github.com/yourusername/klikkfix)

Feature suggestions and pull requests are welcome. Please open an issue before submitting major changes.

---

## 🗃️ License

KlikkFix is open source for **non-commercial use** under a custom license.  
See [LICENSE](./LICENSE) for details or email support@klikkfix.com for commercial use inquiries.

**Created by Mr. Ahmet**  
Fullstack Developer – Creator of KlikkFix and MagicalClick
