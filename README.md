# 🔧 KlikkFix – AI-Powered Text Enhancement in Your Browser

KlikkFix is a smart and intuitive Chrome extension that lets you enhance, rephrase, or professionalize text directly in your browser — all with a single right-click.

---

## 🚀 Features

* ✨ **AI-Powered Enhancements:** Select text, right-click, and instantly improve it using advanced AI (OpenAI API).
* 🧠 **Contextual Understanding:** The extension understands your content and suggests natural improvements.
* 🌐 **Works Everywhere:** Use it in email clients, social media platforms, documents, and websites.
* 🔐 **Secure Login:** Supports Google, GitHub, and Microsoft OAuth — no password required.
* 🛠️ **Personal Toolbox:** Choose tools like rephrasing, improvement, simplification, and more.
* 💳 **Plan Management:** Free and paid plans via Stripe — access is dynamically managed.

---

## 🗭 How It Works

1. Highlight the text you want to improve.
2. Right-click and choose **"Enhance with KlikkFix"**.
3. The text is instantly replaced with an AI-improved version.

---

## 🛠 Technical Overview

* **Manifest:** V3
* **Frontend:** Vanilla JavaScript, HTML, CSS
* **Backend:** Flask (Python), hosted on Render
* **AI:** OpenAI API
* **Payments:** Stripe Checkout with Webhooks
* **Authentication:** Google, GitHub, Microsoft via OAuth2
* **Storage:** Chrome Local Storage and server-side sync via REST API

---

## 🔐 Permissions

| Permission       | Purpose                                       |
| ---------------- | --------------------------------------------- |
| `contextMenus`   | Show right-click options                      |
| `scripting`      | Manipulate selected text on the page          |
| `activeTab`      | Focus on the tab the user is working in       |
| `storage`        | Save user preferences and plan status         |
| `system.display` | Adjust UI components based on screen size     |
| `identity`       | Enables OAuth login without a password        |
| `tabs`           | Read tab info for correct text replacement    |
| `cookies`        | Maintain OAuth sessions across front/backends |

---

## 🔒 Privacy

KlikkFix stores no sensitive information in the extension itself. All text processing is handled securely through encrypted communication with your private AI server. No personal data is tracked, logged, or shared.

See more in [privacy.html](./privacy.html)

---

## 💳 Pricing Plans

| Plan        | Price         | Details                                                 |
| ----------- | ------------- | ------------------------------------------------------- |
| **Basic**   | Free          | 25 requests/day, basic tools only                       |
| **Pro**     | \$9.99/month  | 100 requests/day, all tools except premium              |
| **Premium** | \$14.99/month | Unlimited use, full toolset, MagicalClick, 24/7 support |

---

## 📆 Local Development

### 🔮 Load the Extension

1. Navigate to the `extension` folder:

   ```bash
   cd extension
   ```
2. Open Chrome and visit:

   ```
   chrome://extensions/
   ```
3. Enable **Developer Mode** (top right corner).
4. Click **"Load unpacked"** and select the `extension` folder.

### 🌐 Backend Setup *(Optional)*

KlikkFix uses a Flask backend to manage:

* Stripe subscriptions
* Plan validation and usage limits
* Secure proxying of OpenAI requests

To run locally:

```bash
cd server
```

Create a `.env` file:

```env
STRIPE_SECRET_KEY=sk_live_...
OPENAI_API_KEY=sk-...
OAUTH_CLIENT_IDS=...
```

Run the server:

```bash
pip install -r requirements.txt
flask run
```

Deploy via Render, Railway, or another provider for production.

---

## ✅ Deployment Checklist

* [x] Manifest V3 validated
* [x] Icons (16x16 to 128x128) included
* [x] `privacy.html` linked
* [x] Stripe products/plans created
* [x] Stripe webhooks enabled
* [x] OAuth set up for all providers
* [x] Plan-based tool control working

---

## 🧠 Usage Tips

* Works best in Gmail, Google Docs, Notion, LinkedIn, etc.
* Highlight full sentences for better AI results
* Click the KlikkFix icon to:

  * Manage tools
  * View or change plans

---

## 📩 Support

* 🌐 Website: [KlikkFix](https://klikkfix.com)
* 📧 Email: [support@klikkfix.com](mailto:support@klikkfix.com)
* 🐙 GitHub: [github.com/yourusername/klikkfix](https://github.com/yourusername/klikkfix)

---

## 🗃️ License

This project is licensed under the **MIT License**.
Feel free to fork and build your own AI text assistant!

---

## 💡 About KlikkFix

KlikkFix was created to bring seamless AI-powered writing directly into your browser. From students and professionals to marketers and developers — it saves time and boosts clarity with one click.

**Let AI handle your words — you focus on the ideas.**
