import { getCurrentUserKey, getUserData, checkUsageLimit, userRequestLimit } from './storageUtils.js';

let autoCleanupTimer;
let tokenExpireTime = 60 * 60 * 1000;
let sortableInitialized = false;

const ALL_AVAILABLE_TOOLS = [
    "improveText", "professionalText", "summarizeText", 
    "translateText", "shortenText", "solve", 
    "expandText", "rewriteText"
];

let updateMenuTimeout;
function notifyBackgroundToUpdateMenus() {
    clearTimeout(updateMenuTimeout);
    updateMenuTimeout = setTimeout(() => {
        chrome.runtime.sendMessage({ action: "updateContextMenus" }, (response) => {
            if (response?.success) {
                console.log("✅ Context menus updated in background");
            } else {
                console.warn("⚠️ Could not update context menus");
            }
        });
    }, 200); // Wait 200ms before triggering
}


// **Function to show login UI**
function showLogin() {
    document.getElementById("loginUI").style.display = "block";
    document.getElementById("loginTitle").style.display = "block";
    document.getElementById("dashboardUI").style.display = "none";
    document.getElementById("dashboardTitle").style.display = "none";
    document.getElementById("userPlanUI").style.display = "none";
    document.getElementById("userPlanTitle").style.display = "none";
}

// **Function to show dashboard UI**
function showDashboard() {
    document.getElementById("loginUI").style.display = "none";
    document.getElementById("loginTitle").style.display = "none";
    document.getElementById("userPlanUI").style.display = "none";
    document.getElementById("userPlanTitle").style.display = "none";
    document.getElementById("dashboardUI").style.display = "block";
    document.getElementById("dashboardTitle").style.display = "block";

    const logoutButton = document.querySelector(".logout-btn");
    if (logoutButton) {
        logoutButton.addEventListener("click", logoutUser);
    }

    const logoutProfile = document.querySelector(".logoutProfile");
    if (logoutProfile) {
        logoutProfile.addEventListener("click", logoutUser)
    }

    const profileButton = document.querySelector(".profile-btn");
    if (profileButton) {
        profileButton.addEventListener("click", showUserProfile);
    }

    const currentPlanButton = document.querySelector(".userPlan-btn");
    if (currentPlanButton) {
        currentPlanButton.addEventListener("click", showSubscription);
    }

    const deleteProfileButton = document.querySelector(".deleteProfile");
    if (deleteProfileButton){
        deleteProfileButton.addEventListener("click", deleteProfile)
    }

    const upgradePlanProfile = document.querySelector(".upgradePlanProfile");
    if (upgradePlanProfile){
        upgradePlanProfile.addEventListener("click", showUserPlanPage)
    }

    const allBox = document.getElementById("all-tools");
    const inUseBox = document.getElementById("in-use-tools");

    initializeSlider()

    chrome.storage.local.get("currentUser", (res) => {
        const userId = res.currentUser;
        if (!userId) {
            console.warn("No current user found. Can't load tools.");
            return;
        }

        // Clean the DOM before rebuilding tools
        allBox.innerHTML = '<p class="tool-box-descriptor">All</p>';
        inUseBox.innerHTML = '<p class="tool-box-descriptor">In Use</p>';

        // Load this user's tool configuration
        setupUserTools(userId);

        // Reattach SortableJS with no confusion
        new Sortable(allBox, {
            group: "klikkfix-tools",
            draggable: ".tool-item",
            animation: 200,
            onStart: () => {
                inUseBox.classList.add("dashed-hover");
            },
            onEnd: () => {
                inUseBox.classList.remove("dashed-hover");
                saveUserTools(false);
            }
        });
        

        new Sortable(inUseBox, {
            group: "klikkfix-tools",
            draggable: ".tool-item",
            animation: 200,
            onAdd: (evt) => {
                const inUseItems = inUseBox.querySelectorAll(".tool-item");
                if (inUseItems.length > 5) {
                    // 🚫 Limit exceeded: revert move
                    showToast("You can only have 5 tools in use.", "error");
        
                    // Move the tool back to its original container
                    if (evt.from && evt.item) {
                        evt.from.insertBefore(evt.item, evt.from.children[evt.oldIndex] || null);
                    }
        
                    return; // ⛔ Stop further saving
                }
                            
                saveUserTools(true);
                
            },
            onStart: () => {
                allBox.classList.add("dashed-hover");
            },
            onEnd: () => {
                allBox.classList.remove("dashed-hover");
                saveUserTools(true);
            }
        });
           
        
    });

    loadAndRenderUserInfo(); // Load user details on dashboard
}

document.addEventListener("DOMContentLoaded", function () {
    const expandViewBtn = document.getElementById("expandViewBtn"); // Expand button
    const profileBtn = document.getElementById("")

    // Login buttons
    document.querySelector(".google-btn")?.addEventListener("click", () => loginUser("google"));
    document.querySelector(".github-btn")?.addEventListener("click", () => loginUser("github"));
    document.querySelector(".microsoft-btn")?.addEventListener("click", () => loginUser("microsoft"));

    // Show/hide expand button based on popup size
    if (window.matchMedia("(max-width: 800px) and (max-height: 600px)").matches) {
        expandViewBtn.style.display = "block";
    } else {
        expandViewBtn.style.display = "none";
    }

    expandViewBtn.addEventListener("click", focusOnTab);

    chrome.storage.local.get(["users", "currentUser"], (result) => {
        const userId = result.currentUser;
        const users = result.users || {};
        const userData = users[userId];
        const currentTime = Date.now();

        if (
            userData &&
            userData.authToken &&
            userData.expirationTime > currentTime
        ) {
            console.log("✅ Auto-login: Valid session detected.");
            showToast("Welcome back!", "success");
            showDashboard(); // No need for re-auth!
        } else {
            console.log("🕗 No valid session. Showing login screen.");
            showLogin();
        }
    });
});


function formatToolLabel(toolId) {
    const labels = {
        improveText: "Improve Text",
        professionalText: "Professional Text",
        summarizeText: "Summarize Text",
        translateText: "Translate",
        shortenText: "Shorten Text",
        solve: "Solve Problem",
        expandText: "Expand Text",
        rewriteText: "Rewrite Text"
    };
    return labels[toolId] || toolId;
}

function renderAllToolsOnDashboard(tools) {
    const container = document.getElementById("all-tools");

    // Clear existing tools
    container.innerHTML = '<p class="tool-box-descriptor">All</p>';

    // Re-add each tool
    tools.forEach(tool => {
        const toolDiv = document.createElement("div");
        toolDiv.className = "tool-item";
        toolDiv.innerText = formatToolLabel(tool); // Make label user-friendly
        toolDiv.setAttribute("data-tool-id", tool); // Optional for later drag/drop
        container.appendChild(toolDiv);
    });
}

function renderToolsOnDashboard(tools) {
    const container = document.getElementById("in-use-tools");

    // Clear existing tools
    container.innerHTML = '<p class="tool-box-descriptor">In Use</p>';

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

    const defaultTools = [
        "improveText",
        "summarizeText",
        "solve"
    ];

    chrome.storage.local.get(["users"], (result) => {
        const users = result.users || {};
        const user = users[userIdentifier];

        let inUseTools;

        if (user && Array.isArray(user.tools) && user.tools.length > 0) {
            // Use existing tools
            inUseTools = user.tools;
        } else {
            // 🆕 No saved tools, set defaults
            inUseTools = defaultTools;

            users[userIdentifier] = {
                ...(user || {}),
                tools: inUseTools
            };

            chrome.storage.local.set({ users }, () => {
                console.log("🔧 Default tools saved for user:", userIdentifier);
            });
        }

        // Render In-Use tools
        renderToolsOnDashboard(inUseTools);

        // Render the "All" section with remaining tools
        const remainingTools = ALL_AVAILABLE_TOOLS.filter(tool => !inUseTools.includes(tool));
        renderAllToolsOnDashboard(remainingTools);
    });
}


function saveUserTools(newItemAdded) {
    const inUseContainer = document.getElementById("in-use-tools");

    const updatedTools = Array.from(inUseContainer.querySelectorAll(".tool-item"))
        .map(item => item.getAttribute("data-tool-id"));

    chrome.storage.local.get(["users", "currentUser"], (result) => {
        const userId = result.currentUser;
        const users = result.users || {};
        const userData = users[userId] || {};

        userData.tools = updatedTools;
        users[userId] = userData;

        chrome.storage.local.set({ users }, () => {
            console.log("✅ User tools updated for:", userId);
            if (newItemAdded == true){
                showToast("Item Added", "success")
            }
            notifyBackgroundToUpdateMenus(); // notify the background menu context about the changes
        });
    });
}

async function createCheckoutSession(selectedPlan) {
    const response = await fetch('https://klikkfix-backend.onrender.com/create-checkout-session', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ plan: selectedPlan })
    });

    const data = await response.json();

    if (data.url) {
        // Redirect to Stripe's hosted checkout
        window.location.href = data.url;
    } else {
        alert('Failed to create checkout session');
    }
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
                                storeUserSession(provider, data);
                                resolve(data);
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
                    reject("GitHub login error: " + chrome.runtime.lastError.message);
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
                                storeUserSession(provider, data);
                                resolve(data);
                            } else {
                                showToast("Login failed: " + data.message, "error");
                                console.log("Received data from GitHub auth:", data);
                                reject("Received data from GitHub auth: " + JSON.stringify(data));
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

    const promptParam = "select_account";
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
                    reject("Microsoft login error: " + chrome.runtime.lastError.message);
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
                                storeUserSession(provider, data);
                                resolve(data);
                            } else {
                                showToast("Login failed: " + data.message, "error");
                                console.log("Received data from Microsoft auth:", data);
                                reject("Received data from Microsoft auth: " + JSON.stringify(data));
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

function storeUserSession(provider, data) {
    const user = data.user;
    const userKey = `${provider}:${user.email}`;
    const expirationTime = Date.now() + (data.expires_in * 1000);

    fetch("https://klikkfix-backend.onrender.com/api/get_request_count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, provider: provider })
    })
    .then(response => response.json())
    .then(serverData => {
        const dailyRequests = serverData.success ? serverData.daily_requests : 0;
        continueStoringSession(dailyRequests);
    })
    .catch(error => {
        console.error("Failed to sync request count from server:", error);
        continueStoringSession(0);  // Fallback to 0 if fetch fails
    });

    function continueStoringSession(dailyRequests) {
        chrome.storage.local.get(["users"], (result) => {
            const users = result.users || {};
            const existingUser = users[userKey] || {};

            const updatedUserData = {
                provider: data.provider || provider,
                email: user.email,
                name: user.name,
                username: user.username || user.name,
                authToken: data.access_token,
                expirationTime,
                lastLogin: data.last_login 
                    ? new Date(data.last_login).toLocaleString('nb-NO') 
                    : new Date().toLocaleString('nb-NO'),
                tools: existingUser.tools || [],
                plan: existingUser.plan || "Basic",
                usageCount: dailyRequests
            };

            users[userKey] = updatedUserData;

            chrome.storage.local.set({ users, currentUser: userKey }, () => {
                console.log("✅ Session stored for:", userKey);
                console.log("🧠 User Data:", updatedUserData);

                setupUserTools(userKey); // Setup user tools 
                showDashboard(provider); // Refresh Dashboard UI with fetched data
                notifyBackgroundToUpdateMenus(); // Notify background scripts to update menus
                showToast(`Successfully logged in with ${provider}!`, "success"); // Feedback to user
            });
        });
    }
}


function isSessionExpired(userKey) {
    return new Promise((resolve) => {
        chrome.storage.local.get(["users"], (result) => {
            const user = result.users?.[userKey];
            const currentTime = Date.now();

            if (user && user.expirationTime && user.expirationTime > currentTime) {
                resolve(false);  // ✅ Not expired
            } else {
                resolve(true);   // ❌ Expired or not found
            }
        });
    });
}

function getUserUsageCount(userKey, callback) {
    chrome.storage.local.get(["users"], (result) => {
        const users = result.users || {};
        const user = users[userKey];
        const usageCount = user ? user.usageCount || 0 : 0;
        callback(usageCount);
    });
}


function loginUser(provider) {
    checkForSavedToken(provider, function(valid_token) {
        if (valid_token) {
            notifyBackgroundToUpdateMenus();
            showDashboard();
            loadAndRenderUserInfo();
        } else {
            loginToProvider(provider)
                .then(() => {
                    console.log("Re-authentication completed.");
                    // ✅ Optional: load dashboard again if needed
                })
                .catch(error => {
                    console.error("Re-authentication failed:", error);
                    showToast("Login failed. Please try again.", "error");
                });
        }
    });
}


function logoutUser() {
    chrome.storage.local.get(["users", "currentUser"], (result) => {
        const users = result.users || {};

        // Just end the session — don't delete the user
        chrome.storage.local.set({ users, currentUser: null }, () => {
            console.log("User logged out (session ended).");
            showToast("Logged out", "info");
            showLogin();
        });
    });
}

function loadAndRenderUserInfo() {
    getCurrentUserKey().then((userKey) => {
        if (!userKey) {
            console.warn("No current session found.");
            return;
        }

        isSessionExpired(userKey).then((expired) => {
            if (expired) {
                console.warn("Session expired for:", userKey);
                forceFullReAuthentication(userKey);  // Optional: force logout
                return;
            }

            getUserData(userKey).then((userData) => {
                if (userData) {
                    renderUserInfo(userData);
                } else {
                    console.warn("No data found for:", userKey);
                }
            });
        });
    });
}


function renderUserInfo(profile){
    
    const profileInfoContainer = document.getElementById("profileInfo");
    const accountInfoContainer = document.getElementById("accountInfo");
    const subscriptionInfoContainer = document.getElementById("subscriptionInfo");
    const loggedInAsUser = profile.username && profile.username.trim() !== "" 
                     ? profile.username 
                     : (profile.name || "Unknown User");
    if(profileInfoContainer){
        profileInfoContainer.innerHTML = `
            <p>${loggedInAsUser}</p>
            <p class="email-field" title="${profile.email}">${profile.email}</p>
            <p>${capitalizeFirstLetter(profile.provider)}</p>
            <p>${profile.plan || "Basic"}</p>

        `;
    }

    if (accountInfoContainer){
        accountInfoContainer.innerHTML =  ` 
            <p>${capitalizeFirstLetter(profile.provider)}</p>
            <p>${profile.lastLogin}</p>
        `;
    }

    if (subscriptionInfoContainer){
        subscriptionInfoContainer.innerHTML = `
        <p>${profile.plan}</p>
        <p>${userRequestLimit(profile.plan)}</p> 
        `; 
    }

    animateProgressCircle(); // render progress circle one at login 
}

function showUserProfile() {
    showTab('personal');

    // Remove active-tab from all buttons
    const tabButtons = document.querySelectorAll('.bottomRightTopMenuBtn');
    tabButtons.forEach(btn => btn.classList.remove('active-tab'));

    // Add active-tab to the Profile button
    tabButtons.forEach(btn => {
        if (btn.getAttribute('data-tab') === 'personal') {
            btn.classList.add('active-tab');
        }
    });
}

function showSubscription() {
    showTab('subscription')

    // Remove active-tab from all buttons
    const tabButtons = document.querySelectorAll('.bottomRightTopMenuBtn');
    tabButtons.forEach(btn => btn.classList.remove('active-tab'));

    // Add active-tab to the Profile button
    tabButtons.forEach(btn => {
        if (btn.getAttribute('data-tab') === 'subscription') {
            btn.classList.add('active-tab');
        }
    });

    animateProgressCircle();
}

function showUserPlanPage() {
    document.getElementById("loginUI").style.display = "none";
    document.getElementById("loginTitle").style.display = "none";
    document.getElementById("dashboardUI").style.display = "none";
    document.getElementById("dashboardTitle").style.display = "none";
    document.getElementById("userPlanUI").style.display = "block";
    document.getElementById("userPlanTitle").style.display = "block";
}


// Function to check if a token already exists and is still valid
function checkForSavedToken(provider, callback) {
    chrome.storage.local.get(["users", "currentUser"], (result) => {
        const users = result.users || {};
        const currentTime = Date.now();

        let validUserId = null;

        // 1️⃣ Check currentUser first
        const currentUser = result.currentUser;
        if (currentUser && users[currentUser]) {
            const user = users[currentUser];
            if (user.provider.toLowerCase() === provider.toLowerCase() && user.authToken && user.expirationTime > currentTime) {
                validUserId = currentUser;
            }
        }

        // 2️⃣ Fallback: Scan all users
        if (!validUserId) {
            for (const [userId, user] of Object.entries(users)) {
                if (user.provider.toLowerCase() === provider.toLowerCase() && user.authToken && user.expirationTime > currentTime) {
                    validUserId = userId;
                    break;
                }
            }
        }

        if (validUserId) {
            chrome.storage.local.set({ currentUser: validUserId }, () => {
                console.log("✅ Valid token found. Restored session for:", validUserId);
                showToast("Welcome back!", "success");
                callback(validUserId);  // ✅ Return the actual userId
            });
        } else {
            console.log("❌ No valid session found for provider:", provider);
            callback(null);  // ✅ Return null if no session found
        }
    });
}


function loginToProvider(provider) {
    console.log("Authentication re-required");
    showLoadingIndicator();

    return new Promise((resolve, reject) => {
        chrome.storage.local.get(["users", "currentUser"], (result) => {
            const userId = result.currentUser;
            const users = result.users || {};

            if (userId && users[userId]) {
                // Clear user’s old data (logout-like)
                delete users[userId];
            }

            chrome.storage.local.set({ users }, () => {
                console.log(`Cleared stored token for ${provider}`);
                showToast("Session expired. Please log in again", "info");

                let authProvider;

                if (provider === "github") {
                    authProvider = loginWithGitHub(provider);
                } else if (provider === "microsoft") {
                    authProvider = loginWithMicrosoft(provider);
                } else if (provider === "google") {
                    authProvider = loginWithGoogle(provider);
                } else {
                    showToast("Unknown provider.", "error");
                    removeLoadingIndicator();
                    reject("Unknown provider.");
                    return;
                }

                authProvider
                    .then(() => {
                        removeLoadingIndicator();
                        resolve();  // Resolve when successful
                    })
                    .catch(error => {
                        console.log("Login Failed", error);
                        removeLoadingIndicator();
                        reject(error);  // Reject when failed
                    });
            });
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
function forceFullReAuthentication(providerKey = null) {
    // If providerKey is empty (null) then it clears current session, if not it clear specific session ("google:ahmetugsuz@gmail.com")
    chrome.storage.local.get(["users", "currentUser"], (result) => {
        const users = result.users || {};
        const userKey = providerKey || result.currentUser;

        if (userKey && users[userKey]) {
            delete users[userKey];
        }

        chrome.storage.local.set({ users, currentUser: null }, () => {
            console.log(`🔄 Forced re-authentication for ${userKey || 'current session'}.`);
            showToast("Session expired. Please log in again.", "info");
        });
    });
}


function clearCachedData() {
    chrome.storage.local.get(["users"], (result) => {
        const hasData = Object.keys(result.users || {}).length > 0;

        chrome.storage.local.set({ users: {}, currentUser: null }, () => {
            console.log("✅ All cached user data cleared.");
            showToast(hasData ? "All session data cleared." : "No session data to clear.", "info");
        });
    });
}

function deleteSpecificUser(userKey) {
    chrome.storage.local.get(["users", "currentUser"], (result) => {
        const { users = {}, currentUser } = result;

        if (users[userKey]) {
            delete users[userKey];
            
            const updatedData = { users };

            // Reset currentUser if it matches the one being deleted
            if (currentUser === userKey) {
                updatedData.currentUser = null;
            }

            chrome.storage.local.set(updatedData, () => {
                console.log(`✅ User '${userKey}' removed from storage.`);
                showToast(`User '${userKey}' session cleared.`, "info");
            });
        } else {
            showToast(`No session found for '${userKey}'.`, "info");
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

function showTab(tabId) {
    const tabs = document.querySelectorAll('.bottomRightMainSection');
    tabs.forEach(tab => {
      tab.style.display = 'none'; // Hide all tabs
    });
  
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
      targetTab.style.display = 'block'; // Show the selected tab
    }

    if (tabId === "subscription") {
        animateProgressCircle(); // example values
    }
  }
  
// Buttons listener
document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.bottomRightTopMenuBtn');
  
    // Show default tab and mark the first button as active
    showTab('personal');
    tabButtons.forEach(btn => {
      if (btn.getAttribute('data-tab') === 'personal') {
        btn.classList.add('active-tab');
      }
    });
  
    // Attach event listeners to all buttons
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabId = button.getAttribute('data-tab');
        showTab(tabId);
  
        // Highlight the active button
        tabButtons.forEach(btn => btn.classList.remove('active-tab'));
        button.classList.add('active-tab');
      });
    });

    // Plan selector, button listner
    document.querySelectorAll('.planSelectBtn').forEach((button) => {
        button.addEventListener('click', () => {
            const selectedPlan = button.dataset.plan;
            createCheckoutSession(selectedPlan); // Or your fetch logic
        });
    });
});
    

function animateProgressCircle(duration = 1000) {
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const containers = document.querySelectorAll('.subscriptionScope');
    initializeSlider();

    if (containers.length === 0) return;

    getCurrentUserKey().then((userKey) => {
        if (!userKey) {
            console.warn("No active session found.");
            return;
        }

        getUserData(userKey).then((profile) => {
            if (!profile) {
                console.warn("User data not found for:", userKey);
                return;
            }

            const limit = userRequestLimit(profile.plan);

            getUserUsageCount(userKey, (usageCount) => {
                const current = usageCount;

                containers.forEach(container => {
                    const progressCircle = container.querySelector('.progressCircle .progress');
                    const valueText = container.querySelector('.progressCircle .progressValue');

                    if (!progressCircle || !valueText) return;

                    if (limit === Infinity) {
                        progressCircle.style.strokeDasharray = circumference;
                        progressCircle.style.strokeDashoffset = 0;
                        valueText.textContent = `${current} / Unlimited`;
                        return;
                    }

                    progressCircle.style.strokeDasharray = circumference;
                    progressCircle.style.strokeDashoffset = circumference;
                    valueText.textContent = `0 / ${limit}`;

                    let start = null;

                    function easeIn(t) {
                        return t * t;
                    }

                    function animate(timestamp) {
                        if (!start) start = timestamp;
                        const elapsed = timestamp - start;
                        const rawProgress = Math.min(elapsed / duration, 1);
                        const easedProgress = easeIn(rawProgress);

                        const currentValue = Math.floor(easedProgress * current);
                        const offset = circumference - (easedProgress * current / limit) * circumference;

                        progressCircle.style.strokeDashoffset = offset;
                        valueText.textContent = `${currentValue} / ${limit}`;

                        if (rawProgress < 1) {
                            requestAnimationFrame(animate);
                        }
                    }

                    requestAnimationFrame(animate);
                });
            });
        });
    });
}


// -- Storage Change Listener to update progress bar immediately --
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.users) {
        console.log("🔄 User data changed in storage");

        getCurrentUserKey().then(userKey => {
            if (userKey && changes.users.newValue?.[userKey]) {
                const updatedUser = changes.users.newValue[userKey];
                const limit = userRequestLimit(updatedUser.plan);
                animateProgressCircle(updatedUser.usageCount, limit);
            }
        });
    }
});



function initializeSlider() {
    const slider = document.getElementsByClassName('slider')[0];
    if (!slider) return;

    const track = slider.querySelector('.slider-track');
    const slides = slider.getElementsByClassName('slide');
    const indicators = slider.getElementsByClassName('nav-indicator');
    let currentSlide = 0;
    let autoSwitchInterval; // Store interval reference

    function showSlide(index) {
        track.style.transform = `translateX(-${index * 100}%)`;
        for (let i = 0; i < indicators.length; i++) {
            indicators[i].classList.remove('active');
        }
        indicators[index].classList.add('active');
    }

    // Function to (re)start the auto-switching interval
    function startAutoSwitch() {
        clearInterval(autoSwitchInterval); // Clear existing if any
        let timer = 35000;
        autoSwitchInterval = setInterval(() => {
            currentSlide = (currentSlide + 1) % slides.length;
            showSlide(currentSlide);
        }, timer);
    }

    // Attach click listeners to indicators and reset auto-switch when clicked
    for (let i = 0; i < indicators.length; i++) {
        indicators[i].addEventListener('click', () => {
            currentSlide = i;
            showSlide(currentSlide);
            startAutoSwitch(); // Reset interval when manually changed
        });
    }
    currentSlide=1; // start from page 2-> only to avoid duplicate circle animation on UI
    showSlide(currentSlide); // Initialize first slide
    startAutoSwitch();       // Start auto-switching
}


function deleteProfile() {
    chrome.storage.local.get(["users", "currentUser"], (result) => {
        const { users = {}, currentUser } = result;

        if (currentUser && users[currentUser]) {
            delete users[currentUser];
            
            chrome.storage.local.set({ users, currentUser: null }, () => {
                console.log(`✅ Profile '${currentUser}' deleted.`);
                showToast(`Profile '${currentUser}' has been deleted.`, "info");
            });
            logoutUser();
        } else {
            showToast("No active profile found to delete.", "info");
        }
    });
}


function showMagicalText(slide) {
    const text = slide.querySelector(".MagicalSectionT");
    if (text) text.style.display = "block";
}

function hideMagicalText(slide) {
    const text = slide.querySelector(".MagicalSectionT");
    if (text) text.style.display = "none";
}

function formatTimestamp(timestamp) {
    const date = new Date(Number(timestamp));
    return date.toLocaleString(); // Returns local date and time string
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}