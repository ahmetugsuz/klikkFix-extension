let autoCleanupTimer;
let tokenExpireTime = 60 * 60 * 1000;
let sortableInitialized = false;

// **Function to show login UI**
function showLogin() {
    document.getElementById("loginUI").style.display = "block";
    document.getElementById("loginTitle").style.display = "block";
    document.getElementById("dashboardUI").style.display = "none";
    document.getElementById("dashboardTitle").style.display = "none";
}

// **Function to show dashboard UI**
function showDashboard() {
    document.getElementById("loginUI").style.display = "none";
    document.getElementById("loginTitle").style.display = "none";
    document.getElementById("dashboardUI").style.display = "block";
    document.getElementById("dashboardTitle").style.display = "block";

    const logoutButton = document.querySelector(".logout-btn");
    if (logoutButton) {
        logoutButton.addEventListener("click", logoutUser);
    }

    const allBox = document.getElementById("all-tools");
    const inUseBox = document.getElementById("in-use-tools");

    if (allBox && inUseBox) {
        new Sortable(allBox, {
            group: "klikkfix-tools",
            animation: 200,
            sort: false
        });

        // Load current user to attach save logic
        chrome.storage.local.get("currentUser", (data) => {
            const userIdentifier = data.currentUser;
            if (!userIdentifier) {
                console.warn("No current user found. Cannot save tools.");
                return;
            }

            new Sortable(inUseBox, {
                group: "klikkfix-tools",
                animation: 200,
                onEnd: () => {
                    saveUserTools(userIdentifier); // ✅ Save user’s tools on drop
                }
            });
        });
    }
}


function focusOnTab() {
    const extensionPageUrl = chrome.runtime.getURL("popup.html"); // Change if it's another page

    chrome.tabs.query({ currentWindow: true }, function (tabs) {
        let existingTab = tabs.find(tab => tab.url && tab.url.startsWith(extensionPageUrl));

        if (existingTab) {
            // Reload the tab and focus it
            chrome.tabs.reload(existingTab.id, {}, function () {
                chrome.tabs.update(existingTab.id, { active: true });
            });
        } else {
            // Otherwise, create a new tab
            chrome.tabs.create({ url: extensionPageUrl });
        }
    });
}


document.addEventListener("DOMContentLoaded", function () {
    const expandViewBtn = document.getElementById("expandViewBtn"); // Expand button

    // **Login Button Event Listeners**

    const loginButtonGoogle = document.querySelector(".google-btn");
    if (loginButtonGoogle) {
        loginButtonGoogle.addEventListener("click", () => loginUser("google"));
    }

    const loginButtonGithub = document.querySelector(".github-btn");
    if (loginButtonGithub) {
        loginButtonGithub.addEventListener("click", () => loginUser("github"));
    }

    const loginButtonMicrosoft = document.querySelector(".microsoft-btn");
    if (loginButtonMicrosoft) {
        loginButtonMicrosoft.addEventListener("click", () => loginUser("microsoft"))
    }

    // Check if this is a Chrome extension popup
    if (window.matchMedia("(max-width: 800px) and (max-height: 600px)").matches) {
        expandViewBtn.style.display = "block"; // Show button only if it's a small popup
    } else {
        expandViewBtn.style.display = "none";  // Hide if opened in a full window/tab
    }

    expandViewBtn.addEventListener("click", function () {
        focusOnTab();
    });

    // **Logout Button Event Listener (Added in showDashboard)**


    if (document.getElementById("all-tools") && document.getElementById("in-use-tools")) {
        const allBox = document.getElementById("all-tools");
        const inUseBox = document.getElementById("in-use-tools");

        new Sortable(allBox, {
            group: "klikkfix-tools",
            animation: 200,
            onStart: () => {
                inUseBox.classList.add("dashed-hover");
            },
            onEnd: () => {
                inUseBox.classList.remove("dashed-hover");
            }
        });

        new Sortable(inUseBox, {
            group: "klikkfix-tools",
            animation: 200,
            onStart: () => {
                allBox.classList.add("dashed-hover");
            },
            onEnd: () => {
                allBox.classList.remove("dashed-hover");
            }
        });
    }

});

function formatToolLabel(toolId) {
    const labels = {
        summarizeText: "Summarize Text",
        translateText: "Translate",
        solve: "Solve Problem",
        shortenText: "Shorten Text",
        rewriteText: "Rewrite Text",
        expandText: "Expand Text"
    };
    return labels[toolId] || toolId;
}


function renderToolsOnDashboard(tools) {
    const container = document.getElementById("in-use-tools");

    // Clear existing tools
    container.innerHTML = "<p>In Use</p>";

    // Re-add each tool
    tools.forEach(tool => {
        const toolDiv = document.createElement("div");
        toolDiv.className = "tool-item";
        toolDiv.innerText = formatToolLabel(tool); // Make label user-friendly
        toolDiv.setAttribute("data-tool-id", tool); // Optional for later drag/drop
        container.appendChild(toolDiv);
    });
}

function setupUserTools(userIdentifier) {
    const storageKey = `user:${userIdentifier}`;

    chrome.storage.local.get(storageKey, (result) => {
        if (result[storageKey] && result[storageKey].tools) {
            // 🔁 Load user's saved tools
            const tools = result[storageKey].tools;
            renderToolsOnDashboard(tools);
        } else {
            // 🆕 No saved tools, create default set
            const defaultTools = [
                "summarizeText",
                "translateText",
                "solve",
                "shortenText",
                "rewriteText"
            ];
            const userData = { tools: defaultTools };

            chrome.storage.local.set({ [storageKey]: userData }, () => {
                console.log("🔧 Default tools saved for user:", userIdentifier);
                renderToolsOnDashboard(defaultTools);
            });
        }
    });
}

function saveUserTools(userIdentifier) {
    const storageKey = `user:${userIdentifier}`;
    const inUseContainer = document.getElementById("in-use-tools");

    const updatedTools = Array.from(inUseContainer.querySelectorAll(".tool-item"))
        .map(item => item.getAttribute("data-tool-id"));

    chrome.storage.local.get(storageKey, (result) => {
        const userData = result[storageKey] || {};
        userData.tools = updatedTools;

        chrome.storage.local.set({ [storageKey]: userData }, () => {
            console.log("✅ User tools updated for:", userIdentifier);
        });
    });
}


function loginWithGoogle(provider) {
    console.log("Checking Google login session...");
    const clientId = "743752691512-bn79kokrg755lfmo58k3mo46o6ebnuhe.apps.googleusercontent.com";
    const redirectUri = "https://ofoakggookgcolmahjmnfkamcjfahala.chromiumapp.org/google"; 
    console.log("Redirect uri: ", redirectUri)

    let authUrl = `https://accounts.google.com/o/oauth2/auth?` +
        `client_id=${clientId}` +
        `&response_type=code` +  
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=email profile openid` +
        `&access_type=offline` +  
        `&prompt=select_account`; // Forces the user to choose an account


    return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(
            { url: authUrl, interactive: true },
            function (redirectResponse) {
                if (chrome.runtime.lastError) {
                    showToast("Google login failed", "error");
                    console.error("Google login error:", chrome.runtime.lastError.message);
                    reject("Google login error:" + chrome.runtime.lastError.message)
                    return;
                }

                const urlParams = new URLSearchParams(new URL(redirectResponse).search);
                const code = urlParams.get("code");

                if (code) {
                    console.log("Google authorization code received:", code);

                    // Send code to backend for token exchange
                    fetch("https://klikkfix-backend.onrender.com/auth/google", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ code })
                    })
                        .then(response => response.json())
                        .then(data => {
                            if (data.success) {
                                const expirationTime = Date.now() + (data.expires_in * 1000); // Convert seconds to milliseconds

                                let tokenData = {};
                                tokenData[provider] = { authToken: data.access_token, expirationTime };

                                const user = data.user;
                                const userId = user?.email || user?.name;
                        
                                console.log("User Google Email ", user?.email);
                                console.log("User Google username ", user?.name);
                                setupUserTools(userId);

                                chrome.storage.local.set({...tokenData, currentUser: userId}, () => {
                                    console.log("Token expires at:", new Date(expirationTime).toLocaleString());
                                    showDashboard();
                                    showToast("Successfully logged in with Google!", "success");
                                    resolve();
                                });
                            } else {
                                showToast("Login failed: " + data.message, "error");
                                console.log("Received data from Google auth:", data);
                                chrome.storage.local.remove(provider);
                                reject("Received data from Google auth:" + data);
                            }
                        })
                        .catch(error => {
                            showToast("Network error occurred", "error");
                            console.error("API call error:", error);
                            reject("API call error:" + error)
                        });
                } else {
                    showToast("Authorization code not received", "error");
                    reject("Authorization code not received");
                }
            }
        );
    });
}



function loginWithGitHub(provider) {
    const clientId = "Ov23lip7q8k6rhgL9oFi";
    const redirectUri = chrome.identity.getRedirectURL("github");

    let authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=user` +
        `&prompt=login`;

    return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(
            { url: authUrl, interactive: true },
            function (redirectResponse) {
                if (chrome.runtime.lastError) {
                    showToast("Login failed", "error");
                    console.error("GitHub login error:", chrome.runtime.lastError.message);
                    reject("GitHub login error: " + chrome.runtime.lastError.message)
                    return;
                }

                const urlParams = new URLSearchParams(new URL(redirectResponse).search);
                const code = urlParams.get("code");

                if (code) {
                    fetch("https://klikkfix-backend.onrender.com/auth/github", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ code })
                    })
                        .then(response => response.json())
                        .then(data => {
                            if (data.success) {
                                const expirationTime = Date.now() + (tokenExpireTime || 60 * 60 * 1000); // 1 hour

                                let tokenData = {}; // map the token data to the unique provider, so that one token belongs to one provider 
                                tokenData[provider] = { authToken: data.token, expirationTime }; // stored one-to-one with each provider (logical sense baby) 

                                const user = data.user;
                                const userId = user?.email || user?.name;
                        
                                console.log("User Google Email ", user?.email);
                                console.log("User Google username ", user?.name);
                                setupUserTools(userId);

                                console.log("Data access token to be saved: ", data.token);
                                chrome.storage.local.set({...tokenData, currentUser: userId}, function () {
                                    console.log("Token expires at:", new Date(expirationTime).toLocaleString());
                                    showDashboard();
                                    showToast("Successfully logged in!", "success");
                                    resolve();
                                });
                            } else {
                                showToast("Login failed: " + data.message, "error");
                                console.log("Received data from Github auth:", data);
                                chrome.storage.local.remove(provider);
                                reject("Received data from Github auth: " + JSON.stringify(data));
                            }
                        })
                        .catch(error => {
                            showToast("Network error occurred", "error");
                            console.error("API call error:", error);
                            reject("API call error: " + error);
                        });
                } else {
                    showToast("Authorization code not received", "error");
                    reject("Authorization code not received");
                }
            }
        );
    });
}



function loginWithMicrosoft(provider) {
    const tenantId = "common";
    const clientId = "8ad474fe-8745-47e1-b0c4-9395b8ecea20";
    const redirectUri = "https://ofoakggookgcolmahjmnfkamcjfahala.chromiumapp.org/microsoft";

    const promptParam = "select_account" // forceLogin ? "login" : "select_account";
    const scope = encodeURIComponent("openid profile email User.Read");

    const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
        `client_id=${clientId}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${scope}` +
        `&prompt=${promptParam}`;

    return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(
            { url: authUrl, interactive: true },
            (redirectResponse) => {
                if (chrome.runtime.lastError) {
                    showToast("Login failed", "error");
                    console.error("Microsoft login error:", chrome.runtime.lastError.message);
                    reject("Microsoft login error: " + chrome.runtime.lastError.message)
                    return;
                }

                const urlParams = new URLSearchParams(new URL(redirectResponse).search);
                const code = urlParams.get("code");

                if (code) {
                    console.log("Microsoft authorization code received:", code);

                    fetch("https://klikkfix-backend.onrender.com/auth/microsoft", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ code })
                    })
                        .then(response => response.json())
                        .then(data => {
                            if (data.success) {
                                const expirationTime = Date.now() + (data.expires_in * 1000); // 1 hour default microsoft expire time utilized

                                let tokenData = {}; // map the token data to the unique provider, so that one token belongs to one provider 
                                tokenData[provider] = { authToken: data.access_token, expirationTime }; // one-to-one
                                
                                const user = data.user;
                                const userId = user?.email || user?.name;
                        
                                console.log("User Google Email ", user?.email);
                                console.log("User Google username ", user?.name);
                                setupUserTools(userId);

                                chrome.storage.local.set({...tokenData, currentUser: userId}, () => {
                                    console.log("Token expires at:", new Date(expirationTime).toLocaleString());
                                    showDashboard();
                                    showToast("Successfully logged in!", "success");
                                    resolve();
                                });
                            } else {
                                showToast("Login failed: " + data.message, "error");
                                console.log("Received data from Microsoft auth:", data);
                                chrome.storage.local.remove(provider);
                                reject("Received data from Microsoft auth: " + JSON.stringify(data));
                            }
                        })
                        .catch(error => {
                            showToast("Network error occurred", "error");
                            console.error("API call error:", error);
                            reject("API call error: " + error)
                        });
                } else {
                    showToast("Authorization code not received", "error");
                    reject("Authorization code not received");
                }
            }
        );
    });
}

function loginUser(provider) {
    checkForSavedToken(provider, function(valid_token) {
        if (valid_token) {
            showDashboard();
        } else {
            loginToProvider(provider);
        }
    });
}


function logoutUser() {
    console.log("User logged out.");
    showToast("Logged out", "info");
    showLogin(); // Show login screen immediately

    //forceFullReAuthentication(); // debug command to logout user
    //clearCachedData(); // Clear all cached data for all providers
}

// Function to check if a token already exists and is still valid
function checkForSavedToken(provider, callback) {
    chrome.storage.local.get(provider, function (result) {
        const currentTime = Date.now();
        const providerData = result[provider]; // Get data for the requested provide tokenData: {token, expireTime}
        if (providerData && providerData.authToken && providerData.expirationTime && providerData.expirationTime > currentTime) {
            console.log(`${provider} Token is valid. Redirecting to dashboard...`);
            showToast("Welcome back!", "success");
            callback(true);
        } else {
            console.log("Session expired. Forcing re-authentication...");
            if (!providerData){
                console.log("Provider Data not found");
            }
            else if (!providerData.authToken){
                console.log("AuthToken not found")
            }
            else if (!providerData.expirationTime) {
                console.log("No expiration time found")
            }
            else if (currentTime >= result.expirationTime){
                console.log("Experiation time has expired!")
            }
            callback(false);
        }
    });
}

function loginToProvider(provider){
    console.log("Authentication re-required")
    showLoadingIndicator();
    chrome.storage.local.remove(provider, () => {
        console.log(`Cleared stored token for ${provider}`);
        showToast("Session expired. Please log in again", "info");

        let authProvider; 

        if (provider === "github") {
            authProvider = loginWithGitHub(provider);
        } else if (provider === "microsoft") {
            authProvider = loginWithMicrosoft(provider);
        } else if (provider === "google"){
            authProvider = loginWithGoogle(provider)
        } 
        else {
            showToast("Unknown provider.", "error");
            removeLoadingIndicator(); // remove loading indicator if it fails immidiately
            return;
        }
        
        authProvider
            .then(() =>  removeLoadingIndicator())
            .catch(error => {
                console.log("Login Failed", error);
                removeLoadingIndicator();
            });
    });    
}

function removeLoadingIndicator() {
    // Remove the loading indicator
    const loadingIndicator = document.getElementById("klikkfix-loading");
    if (loadingIndicator) {
        loadingIndicator.remove();
    }
}

// Helper function to force re-authentication
function forceFullReAuthentication(provider) {
    console.log("New Login (Forced)")
    chrome.storage.local.remove(provider, () => {
        console.log(`Cleared stored token for ${provider}`);
        showToast("Session expired. Please log in again.", "warning");
        
    });
}

function clearCachedData() {
    const providers = ["github", "microsoft", "google"]; // List of all supported providers

    console.log("Checking for cached data across all providers...");

    chrome.storage.local.get(null, (result) => {
        let foundData = false;

        providers.forEach((provider) => {
            if (result[provider]) {
                foundData = true;
                console.log(`Found cached data for ${provider}, clearing it now...`);
                chrome.storage.local.remove(provider, () => {
                    console.log(`Cleared stored token for ${provider}`);
                    showToast(`Session expired. Please log in again with ${provider}.`, "warning");
                });
            } else {
                console.log(`No cached data found for ${provider}.`);
            }
        });

        if (!foundData) {
            console.log("No cached auth data found for any provider.");
        }
    });
}

// **Function to show toast messages**
function showToast(message, type = "error") {
    // Remove any existing toast
    const existingToast = document.querySelector(".toast");
    if (existingToast) {
        existingToast.remove(); // Remove old toast if it exists
    }

    let toast = document.createElement("div");

    toast.className = `toast ${type}`;
    toast.innerText = message;
    document.body.appendChild(toast);

    toast.addEventListener("click", () => toast.remove()); // removes the Toast when clicked

    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// Show Loading Indicator at Bottom Right
function showLoadingIndicator() {
    if (document.getElementById("klikkfix-loading")) return;

    let loader = document.createElement("div");
    loader.id = "klikkfix-loading";
    loader.innerHTML = `
        <div style="
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 35px;
            height: 35px;
            border: 4px solid #ccc;
            border-top: 4px solid black;
            border-radius: 50%;
            animation: spin 1.2s linear infinite;
            z-index: 10000;
        "></div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    document.body.appendChild(loader);
}


