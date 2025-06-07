import { getCurrentUserKey, getUserData, checkUsageLimit, userRequestLimit, isSessionExpired, isPlanExpired, getUserUsageCount } from './storageUtils.js';

let autoCleanupTimer;
let tokenExpireTime = 60 * 60 * 1000;
let sortableInitialized = false;

const ALL_AVAILABLE_TOOLS = [
    "improveText", "professionalText", "summarizeText", 
    "translateText", "shortenText", "solve", 
    "expandText", "rewriteText"
];

const BASIC_PLAN_TOOLS = [
    "improveText", "summarizeText", "rewriteText", "solve"
];

const LOCKED_TOOLS = [
    "improveText", "professionalText", "summarizeText", 
    "translateText", "shortenText", "solve", 
    "expandText", "rewriteText"
];
  
document.addEventListener('DOMContentLoaded', () => {
    // === Lucide Icons ===
    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    } else {
        console.error("Lucide is not loaded!");
    }

    // === Tab Buttons ===
    const tabButtons = document.querySelectorAll('.bottomRightTopMenuBtn');
    showTab('personal');
    tabButtons.forEach(btn => {
        if (btn.getAttribute('data-tab') === 'personal') {
            btn.classList.add('active-tab');
        }
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            showTab(tabId);
            tabButtons.forEach(b => b.classList.remove('active-tab'));
            btn.classList.add('active-tab');
        });
    });

    // === Plan Selector ===
    document.querySelectorAll('.planSelectBtn').forEach((button) => {
        button.addEventListener('click', async () => {
            const selectedPlan = button.dataset.plan;
            const currentUserKey = await getCurrentUserKey();
            if (selectedPlan.toLowerCase() === 'basic') {
                activateBasicPlan(currentUserKey);
            } else {
                createCheckoutSession(selectedPlan, currentUserKey);
            }
        });
    });

    // === Login Buttons ===
    document.querySelector(".google-btn")?.addEventListener("click", () => loginUser("google"));
    document.querySelector(".github-btn")?.addEventListener("click", () => loginUser("github"));
    document.querySelector(".microsoft-btn")?.addEventListener("click", () => loginUser("microsoft"));

    // === Expand View Button ===
    const expandViewBtn = document.getElementById("expandViewBtn");
    if (expandViewBtn) {
        expandViewBtn.style.display = window.matchMedia("(max-width: 800px) and (max-height: 600px)").matches ? "block" : "none";
        expandViewBtn.addEventListener("click", focusOnTab);
    }

    /*
    // === Session Check ===
    chrome.storage.local.get(["users", "currentUser"], (result) => {
        const userId = result.currentUser;
        const users = result.users || {};
        const userData = users[userId];
        const currentTime = Date.now();

        
        if (userData?.authToken && userData.expirationTime > currentTime) {

            getCurrentUserPlan(userData).then((plan) => {
                if (plan.toLowerCase() === 'basic' && userData.basic_plan_deactivated){
                    showUserPlanPage();
                }
            });

            getCurrentUserPlan(userData).then((syncedData) => {
                if (!syncedData?.plan) {
                    showUserPlanPage();
                } else {
                    chrome.storage.local.get(["users", "currentUser"], (res) => {
                        const syncedUser = res.users?.[res.currentUser];
                        if (syncedUser) {
                            renderUserInfo(syncedUser);
                            showDashboard();
                        }
                    });
                }
            });
        } else {
            console.log("🕗 No valid session. Showing login screen.");
            showLogin();
        }
    });
    */

    // === Session Check ===
    checkUserPlanOrRedirect();

    const productPageBackBtn = document.querySelector(".productPageBackBtn");
    if (productPageBackBtn) {
        productPageBackBtn.addEventListener("click",  () => checkUserPlanOrRedirect());
    }

});


function refreshPage(comingFrom) {
    showDashboard();
}
async function checkUserPlanOrRedirect() {
    chrome.storage.local.get(["users", "currentUser"], async (result) => {
        const userId = result.currentUser;
        const users = result.users || {};
        const user = users[userId];

        if (!userId || !user) {
            console.log("No current user found in storage.");
            return showLogin();
        }

        const localPlan = user.plan?.toLowerCase();
        const isLocalDeactivated = user.basic_plan_deactivated === true;

        // 🔒 Check local first
        if (localPlan === 'basic' && isLocalDeactivated) {
            console.log("Basic plan is deactivated. Redirecting to plan page.");
            return showLogin();
        }

        if (localPlan && !isLocalDeactivated) {
            console.log("User has active plan:", localPlan);
            return showDashboard();
        }

        

        // 🧠 Plan missing — fetch from DB
        showLoadingIndicator();
        const updatedPlan = await getCurrentUserPlan(); // includes plan + deactivated flag
        removeLoadingIndicator();

        if (!updatedPlan || (updatedPlan.plan?.toLowerCase() === 'basic' && updatedPlan.basic_plan_deactivated === true)) {
            console.log("No valid plan or basic plan expired.");
            return showLogin(); // this was showUserPlanPage(); BE CAREFUL
        }

        // ✅ Update local if needed
        users[userId].plan = updatedPlan.plan;
        users[userId].basic_plan_deactivated = updatedPlan.basic_plan_deactivated;
        chrome.storage.local.set({ users });

        return showDashboard();
    });
}

let dashboardRendered = false;

// =========== WINDOW SECTION ===========
// **Function to show login UI**
function showLogin() {
    document.getElementById("loginUI").style.display = "block";
    document.getElementById("loginTitle").style.display = "block";
    document.getElementById("dashboardUI").style.display = "none";
    document.getElementById("dashboardTitle").style.display = "none";
    document.getElementById("userPlanUI").style.display = "none";
    document.getElementById("userPlanTitle").style.display = "none";

    dashboardRendered = false;
}

// **Function to show dashboard UI**

async function showDashboard() {
    if (dashboardRendered) return;
    dashboardRendered = true;

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

    const upgradePlanLink = document.getElementById("upgradePlanLink");
    if (upgradePlanLink){
        upgradePlanLink.addEventListener("click", showUserPlanPage)
    }

    const allBox = document.getElementById("all-tools");
    const inUseBox = document.getElementById("in-use-tools");

    initializeSlider();
    
    chrome.storage.local.get("currentUser", (res) => {
        const userId = res.currentUser;
        if (!userId) {
            console.log("No current user found. Can't load tools.");
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
            draggable: ".tool-item:not(.locked)",
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
            draggable: ".tool-item:not(.locked)",
            animation: 200,
            onAdd: (evt) => {
                const inUseItems = inUseBox.querySelectorAll(".tool-item");
            
                chrome.storage.local.get(["users", "currentUser"], (result) => {
                    const userId = result.currentUser;
                    const user = result.users?.[userId];
                    const maxTools = getMaxToolsForPlan(user?.plan);
            
                    if (inUseItems.length > maxTools) {
                        showToast(`You can only have ${maxTools} tools in use.`, "error");
            
                        // Revert move
                        if (evt.from && evt.item) {
                            evt.from.insertBefore(evt.item, evt.from.children[evt.oldIndex] || null);
                        }
                        return;
                    }
            
                    saveUserTools(true); // ✅ Only save if within limits
                });
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

async function showUserPlanPage() {
    dashboardRendered=false;
    const userKey = await getCurrentUserKey();
    if (!userKey) {
        showToast("No active user found. Please log in.", "error");
        return showLogin();
    }

    const expired = await isSessionExpired(userKey);
    if (expired) {
        showToast("Your session has expired. Please log in again.", "error");
        return setTimeout(() => showLogin(), 1500);
    }

    // ✅ Session is valid, display the plan selection UI
    document.getElementById("loginUI").style.display = "none";
    document.getElementById("loginTitle").style.display = "none";
    document.getElementById("dashboardUI").style.display = "none";
    document.getElementById("dashboardTitle").style.display = "none";
    document.getElementById("userPlanUI").style.display = "block";
    document.getElementById("userPlanTitle").style.display = "block";

    const user = await getUserData(userKey);
    const planRaw = user?.plan;
    const currentPlan = (typeof planRaw === "string" && planRaw.trim() !== "null" && planRaw.trim() !== "") 
        ? planRaw.toLowerCase() 
        : null;
    

        if (!currentPlan) {
            // ⛔ Plan is null — ensure no "Current Plan" badges are shown
            document.querySelectorAll('.planContainer').forEach((container) => {
                container.style.opacity = "1";
                const button = container.querySelector(".planSelectBtn");
                if (button) {
                    button.disabled = false;
                    button.style.cursor = "pointer";
                    button.style.pointerEvents = "auto";
                }
                container.querySelector('.current-plan-label')?.remove();
                container.querySelector('.expired-plan-label')?.remove();
            });
        
            console.log("No plan found for current user");
            return;
        }
        
    const isBasicDeactivated = user?.basic_plan_deactivated === true;

    // Loop through and adjust each plan container
    document.querySelectorAll('.planSelectBtn').forEach((button) => {
        const plan = button.dataset.plan?.toLowerCase();
        const container = button.closest('.planContainer');
        const isCurrent = plan === currentPlan;
        const isBasic = plan === "basic";
        const isBasicDeactivated = user?.basic_plan_deactivated === true;
    
        // Always clean labels first
        container.querySelector('.current-plan-label')?.remove();
        container.querySelector('.expired-plan-label')?.remove();
    
        // 🔒 If basic is deactivated, block it hard regardless of plan status
        if (isBasic && isBasicDeactivated) {
            container.style.opacity = "0.65";
            button.disabled = true;
            button.style.cursor = "not-allowed";
            button.style.pointerEvents = "none";
    
            const expiredLabel = document.createElement("div");
            expiredLabel.textContent = "Expired";
            expiredLabel.classList.add("expired-plan-label");
            container.appendChild(expiredLabel);
            return; // ❌ Stop here for Basic
        }
    
        // ✅ Handle current plan (but only if not deactivated)
        if (isCurrent) {
            container.style.opacity = "0.65";
            button.disabled = true;
            button.style.cursor = "not-allowed";
            button.style.pointerEvents = "none";
    
            const label = document.createElement("div");
            label.textContent = "Current Plan";
            label.classList.add("current-plan-label");
            container.appendChild(label);
        } else {
            container.style.opacity = "1";
            button.disabled = false;
            button.style.cursor = "pointer";
            button.style.pointerEvents = "auto";
        }
    });
    
}

// ========= TOOLS SECTION =========
function getAllowedTools(plan) {
    if (!plan){
        return LOCKED_TOOLS;
    }
    if (plan?.toLowerCase() === "basic") {
        return BASIC_PLAN_TOOLS;
    }
    return ALL_AVAILABLE_TOOLS;
}

function getMaxToolsForPlan(plan) {
    return plan?.toLowerCase() === "basic" ? 3 : 5;
}

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


let updateMenuTimeout;
function notifyBackgroundToUpdateMenus() {
    clearTimeout(updateMenuTimeout);
    updateMenuTimeout = setTimeout(() => {
        chrome.runtime.sendMessage({ action: "updateContextMenus" }, (response) => {
            if (response?.success) {
                console.log("✅ Context menus updated in background");
            } else {
                console.log("⚠️ Could not update context menus");
            }
        });
    }, 200); // Wait 200ms before triggering
}



// =========== DASHBOARD RENDER SECTION ============
function renderAllToolsOnDashboard(tools) {
    const container = document.getElementById("all-tools");

    container.innerHTML = '<p class="tool-box-descriptor">All</p>';

    chrome.storage.local.get(["users", "currentUser"], (result) => {
        const userKey = result.currentUser;
        const users = result.users || {};
        const user = users[userKey];

        const plan = user?.plan?.toLowerCase() || "basic";
        const maxTools = plan === "basic" ? 3 : 5; // not in use
        const allowedTools = getAllowedTools(plan);

        tools.forEach(tool => {
            const toolDiv = document.createElement("div");
            toolDiv.className = "tool-item";
            toolDiv.innerText = formatToolLabel(tool);
            toolDiv.setAttribute("data-tool-id", tool);

            if (!allowedTools.includes(tool)) {
                toolDiv.classList.add("locked");
            }

            container.appendChild(toolDiv);
        });
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

function loadAndRenderUserInfo() {
    getCurrentUserKey().then((userKey) => {
        if (!userKey) {
            console.log("No current session found.");
            return;
        }

        isSessionExpired(userKey).then((expired) => {
            if (expired) {
                console.log("Session expired for:", userKey);
                forceFullReAuthentication(userKey);  // Optional: force logout
                return;
            }

                getUserData(userKey).then((userData) => {
                    if (userData) {
                        renderUserInfo(userData);
                    } else {
                        console.log("No data found for:", userKey);
                    }
                });
        });
    });
}

function renderUserInfo(profile){
    
    const profileInfoContainer = document.getElementById("profileInfo");
    const accountInfoContainer = document.getElementById("accountInfo");
    const subscriptionInfoContainer = document.getElementById("subscriptionInfo");
    const subscriptionLeftSide = document.getElementById("subscriptionLeftSide");
    const loggedInAsUser = profile.username && profile.username.trim() !== ""
        ? profile.username
        : (profile.name || "Unknown User");
    const currentPlanButton = document.querySelector(".userPlan-btn");
    if (currentPlanButton) {
        const planLabel = currentPlanButton.querySelector("div");
        if (planLabel) {
            planLabel.textContent = capitalizeFirstLetter(profile.plan) + " Plan" || "Plan";
        }
    }

    if(profileInfoContainer){
        profileInfoContainer.innerHTML = `
            <p>${loggedInAsUser}</p>
            <p class="email-field" title="${profile.email}">${profile.email}</p>
            <p>${capitalizeFirstLetter(profile.provider)}</p>
            <p>${capitalizeFirstLetter(profile.plan) || ""}</p>

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
        <p>${capitalizeFirstLetter(profile.plan)}</p>
        <p>${userRequestLimit(profile.plan)}</p> 
        `; 
    }

    if (profile.plan.toLowerCase() === 'basic'){
        if (subscriptionInfoContainer && subscriptionLeftSide){
            subscriptionLeftSide.innerHTML = `
            <p>Current Plan:</p>
            <p>Daily Request Limit:</p>
            <p>Plan Expires At:</p>
            `;

            subscriptionInfoContainer.innerHTML = `
            <p>${capitalizeFirstLetter(profile.plan)}</p>
            <p>${userRequestLimit(profile.plan)}</p> 
            <p>${new Date(profile.plan_expires_at).toLocaleDateString('nb-NO')}</p> 
            `; 
        }
    }

    if ((profile.plan.toLowerCase() === 'pro' || profile.plan.toLowerCase() === 'premium') && profile.plan_renews_at){
        if (subscriptionInfoContainer && subscriptionLeftSide){
            subscriptionLeftSide.innerHTML = `
            <p>Current Plan:</p>
            <p>Daily Request Limit:</p>
            <p>Renewal At:</p>
            `;

            subscriptionInfoContainer.innerHTML = `
            <p>${capitalizeFirstLetter(profile.plan)}</p>
            <p>${userRequestLimit(profile.plan)}</p> 
            <p>${new Date(profile.plan_renews_at).toLocaleDateString('nb-NO')}</p> 
            `; 
        }
    }
    animateProgressCircle(); // render progress circle one at login 
}




// ======= PAYMENT SECTION =======
async function createCheckoutSession(selectedPlan, currentUserKey = null) {
    showLoadingIndicator(); // Start Loading indicator

    try {
        // Get the latest synced exisiting user plan 
        const syncedPlan = await getCurrentUserPlan();

        const response = await fetch('https://klikkfix-backend.onrender.com/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ plan: selectedPlan, currentUserKey })
        });

        const data = await response.json();
        console.log("Data came from backend for checkout session ", data);

        if (data.url) {
            const email = currentUserKey.split(':')[1];
            const provider = currentUserKey.split(':')[0];
            window.open(data.url, '_blank'); // Opens Stripe Checkout
            // Stripe + webhook time to react
            setTimeout(() => startPlanPolling(email, provider, syncedPlan, selectedPlan), 2000); // Automatically update backend to check if user has completed transaction
        } else {
            alert('Failed to create checkout session');
        }

    } catch (error) {
        console.error("Error creating checkout session:", error);
        alert("An error occurred. Please try again.");
    } finally {
        //removeLoadingIndicator(); // Remove Loading indicator
    }
}

let pollingInterval;
let pollingTimeout;

function startPlanPolling(userEmail, provider, currentPlan, selectedPlan) {
    let attempts = 0;
    const maxAttempts = 80; // ~4 min if interval is 2 sec
    const pollingIntervalMs = 3000; // update every 3 seconds
    showLoadingIndicator();

    pollingInterval = setInterval(async () => {
        attempts++;
        const response = await fetch('https://klikkfix-backend.onrender.com/api/get_user_plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, provider })
        });

        const data = await response.json();
        console.log("Selected plan: ", selectedPlan, " Current Plan: ", currentPlan)
        if (data.success && data.plan === selectedPlan) {
            clearInterval(pollingInterval);
            clearTimeout(pollingTimeout);
            await updatePlanInStorage({
                plan: data.plan,
                plan_expires_at: data.plan_expires_at || null,
                plan_renews_at: data.plan_renews_at || null
            });

            removeLoadingIndicator();
            showToast(`Plan activated: ${capitalizeFirstLetter(data.plan)}`, 'success');
            showDashboard(provider);
        }
        

        if (attempts >= maxAttempts) {
            clearInterval(pollingInterval);
            removeLoadingIndicator();
            showToast("❌ Payment not detected. Try again.", 'error');
        }
    }, pollingIntervalMs);

    // Safety net in case polling never resolves
    pollingTimeout = setTimeout(() => {
        clearInterval(pollingInterval);
        removeLoadingIndicator();
        showToast("⏱️ Timeout waiting for Stripe confirmation.", 'error');
    }, maxAttempts * pollingIntervalMs + 2000);
}

async function updatePlanInStorage({ plan, plan_expires_at = null, plan_renews_at = null }) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['currentUser', 'users'], (result) => {
            const users = result.users || {};
            const currentUser = result.currentUser;
            if (users[currentUser]) {
                // Update in chrome storage:
                users[currentUser].plan = plan;
                users[currentUser].plan_expires_at = plan_expires_at;
                users[currentUser].plan_renews_at = plan_renews_at;
                //users[currentUser].plan_expires_at = plan_expires_at;
                chrome.storage.local.set({ users }, () => {
                    console.log("🔁 Local storage plan updated:", plan);
                    resolve();
                });
            } else {
                resolve(); // Do nothing if user not found
            }
        });
    });
}



// ========  AUTHENTICATION SECTION WITH PROVIDERS ==========
async function loginWithGoogle(provider) {
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
                        .then(async (data) => {
                            if (data.success) {       
                                const user = await storeUserSession(provider, data);
                                resolve(user);
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


async function loginWithGitHub(provider) {
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
                        .then(async (data) => {
                            if (data.success) {
                                const user = await storeUserSession(provider, data);
                                resolve(user);
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

async function loginWithMicrosoft(provider) {
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
            async (redirectResponse) => {
                if (chrome.runtime.lastError) {
                    showToast("Login failed", "error");
                    console.error("Microsoft login error:", chrome.runtime.lastError.message);
                    reject("Microsoft login error: " + chrome.runtime.lastError.message);
                    return;
                }

                const urlParams = new URLSearchParams(new URL(redirectResponse).search);
                const code = urlParams.get("code");

                if (!code) {
                    showToast("Authorization code not received", "error");
                    reject("Authorization code not received");
                    return;
                }

                console.log("Microsoft authorization code received:", code);

                try {
                    const response = await fetch("https://klikkfix-backend.onrender.com/auth/microsoft", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ code }),
                    });

                    const data = await response.json();

                    if (data.success) {
                        const user = await storeUserSession(provider, data);
                        resolve(user);
                    } else {
                        showToast("Login failed: " + data.message, "error");
                        console.log("Received data from Microsoft auth:", data);
                        reject("Received data from Microsoft auth: " + JSON.stringify(data));
                    }
                } catch (error) {
                    showToast("Network error occurred", "error");
                    console.error("API call error:", error);
                    reject("API call error: " + error);
                }
            }
        );
    });
}




// =========== STORE USER SECTION ===========
async function storeUserSession(provider, data) {
    const user = data.user;
    const userKey = `${provider}:${user.email}`;
    const expirationTime = Date.now() + (data.expires_in * 1000);

    // 1️⃣ Fetch daily request count
    let dailyRequests = 0;
    try {
        const response = await fetch("https://klikkfix-backend.onrender.com/api/get_request_count", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: user.email, provider }),
        });

        const serverData = await response.json();
        dailyRequests = serverData.success ? serverData.daily_requests : 0;
    } catch (error) {
        console.error("❌ Failed to sync request count from server:", error);
    }

    // 2️⃣ Save user data to Chrome local storage
    return new Promise((resolve) => {
        chrome.storage.local.get(["users"], async (result) => {
            const users = result.users || {};
            const existingUser = users[userKey] || {};

            const updatedUserData = {
                provider: data.provider || provider,
                email: user.email,
                name: user.name || user.username,
                username: user.username || user.name,
                authToken: data.access_token,
                expirationTime,
                lastLogin: data.last_login 
                    ? new Date(data.last_login).toLocaleString('nb-NO') 
                    : new Date().toLocaleString('nb-NO'),
                tools: existingUser.tools || [],
                plan: null,
                plan_expires_at: null,
                plan_renews_at: null,
                basic_plan_deactivated: !!data.basic_plan_deactivated,
                usageCount: dailyRequests
            };

            users[userKey] = updatedUserData;

            // Save and sync plan
            chrome.storage.local.set({ users, currentUser: userKey }, async () => {
                console.log("✅ Session stored for:", userKey);
                console.log("🧠 User Data:", updatedUserData);

                setupUserTools(userKey);

                const syncedPlan = await getCurrentUserPlan(updatedUserData);
                console.log("🔄 Synced plan after check:", syncedPlan);

                if (syncedPlan) {
                    const fullUserProfile = {
                        ...updatedUserData,
                        ...syncedPlan
                    };

                    // Just return it, let loginToProvider decide what to do
                    resolve(fullUserProfile);
                } else {
                    resolve(null);  // No plan found, let caller handle it
                }
            });
        });
    });
}

async function getCurrentUserPlan(userData = null) {
    return new Promise((resolve) => {
        if (userData) {
            chrome.storage.local.get(['currentUser'], (res) => {
                const expectedKey = `${userData.provider}:${userData.email}`;
                if (res.currentUser !== expectedKey) {
                    chrome.storage.local.set({ currentUser: expectedKey }, () => {
                        fetchPlanAndUpdate(userData);
                    });
                } else {
                    fetchPlanAndUpdate(userData);
                }
            });
        } else {
            chrome.storage.local.get(['currentUser', 'users'], (result) => {
                const userKey = result.currentUser;
                const users = result.users || {};
                const storedUser = users[userKey];

                if (!userKey || !storedUser) {
                    console.log("No active user found in storage");
                    return resolve(null);
                }

                fetchPlanAndUpdate(storedUser);
            });
        }

        async function fetchPlanAndUpdate(user) {
            try {
                const response = await fetch('https://klikkfix-backend.onrender.com/api/get_user_plan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: user.email, provider: user.provider })
                });

                const data = await response.json();

                if (data.success && data.plan) {
                    chrome.storage.local.get(['users'], (storage) => {
                        const users = storage.users || {};
                        const userKey = `${user.provider}:${user.email}`;
                        users[userKey] = {
                            ...users[userKey],
                            plan: data.plan,
                            plan_expires_at: data.plan_expires_at || null,
                            plan_renews_at: data.plan_renews_at || null,
                            basic_plan_deactivated: data.basic_plan_deactivated || false
                        };

                        chrome.storage.local.set({ users }, () => {
                            console.log(`✅ Plan updated to ${data.plan} for ${userKey}`);
                            resolve({
                                plan: data.plan,
                                plan_expires_at: data.plan_expires_at || null,
                                plan_renews_at: data.plan_renews_at || null,
                                basic_plan_deactivated: data.basic_plan_deactivated || false
                            });
                        });
                    });
                } else {
                    console.log("Plan fetch failed or no plan returned", data);
                    resolve(null);
                }

            } catch (err) {
                console.error("❌ Error fetching user plan:", err);
                resolve(null);
            }
        }
    });
}


async function loginUser(provider) {
    checkForSavedToken(provider, async function (valid_token) {
        if (valid_token) {
            notifyBackgroundToUpdateMenus();

            // 🧠 Fetch user plan info before showing dashboard
            const userData = await getCurrentUserPlan();
            const plan = userData?.plan?.toLowerCase();
            const isDeactivated = userData?.basic_plan_deactivated;

            if (plan === 'basic' && isDeactivated) {
                showToast("Your Basic plan has expired. Please choose a new plan.", "info");
                return showUserPlanPage(); // 🛑 Don't continue to dashboard
            }

            // ✅ All clear — show dashboard
            showDashboard();
            loadAndRenderUserInfo();
        } else {
            loginToProvider(provider)
                .then(async () => {
                    console.log("✅ Re-authentication completed.");
                    
                    // Optional: re-run loginUser(provider) here
                                        // 🔍 Debug full chrome storage
                                        chrome.storage.local.get(null, (fullStorage) => {
                                            console.log("🧠 FULL STORAGE DEBUG DUMP:");
                                            console.log(JSON.stringify(fullStorage, null, 2));
                                        });

                    /*
                    // now check if the user have basic plan and if it is expired.
                    const userData = await getCurrentUserPlan();
                    const plan = userData?.plan?.toLowerCase();
                    const isDeactivated = userData?.basic_plan_deactivated;
                    console.log("SPECIAL TEST: plan is ", plan, ", is deactivated: ", isDeactivated);
                    if (plan === 'basic' && isDeactivated) {
                        showToast("Basic plan has expired.", "info");
                        showUserPlanPage();
                        return;
                    }
                    // returns updated data from db
                    */
                })
                .catch(error => {
                    console.log("❌ Re-authentication failed:", error);
                    //showToast("Login failed. Please try again.", "error");
                });
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
                    .then(async (userData) => {

                            console.log("✅ Re-authentication completed.");
                            // Optional: re-run loginUser(provider) here
        
                            // now check if the user have basic plan and if it is expired.
                            const plan = userData?.plan?.toLowerCase();
                            const isDeactivated = userData?.basic_plan_deactivated;

                            if (!plan){
                                showToast("Please choose a plan to continue.", "info")
                                showUserPlanPage();
                                removeLoadingIndicator();
                                reject("Choose a plan");
                                return;
                            }

                            console.log("SPECIAL TEST: plan is ", plan, ", is deactivated: ", isDeactivated);
                            if (plan === 'basic' && isDeactivated) {
                                showToast("Basic plan has expired.", "error");
                                showUserPlanPage();
                                reject("Basic plan expired");
                                removeLoadingIndicator();
                                return;
                            }
                            // returns updated data from db

                            // Show dashboard
                            renderUserInfo(userData);
                            showDashboard(provider);
                            notifyBackgroundToUpdateMenus();

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
function checkForSavedToken(provider, callback) {
    showLoadingIndicator();
    chrome.storage.local.get(["users", "currentUser"], (result) => {
        const users = result.users || {};
        const currentTime = Date.now();

        let validUserId = null;

        // 1️⃣ Check currentUser first
        const currentUser = result.currentUser;
        if (currentUser && users[currentUser]) {
            const user = users[currentUser];
            const hasValidPlan = typeof user.plan === "string" && user.plan.trim() !== "";

            if (
                user.provider.toLowerCase() === provider.toLowerCase() &&
                user.authToken &&
                user.expirationTime > currentTime &&
                hasValidPlan
            ) {
                validUserId = currentUser;
            }
        }

        // 2️⃣ Fallback: Scan all users
        if (!validUserId) {
            for (const [userId, user] of Object.entries(users)) {
                const hasValidPlan = typeof user.plan === "string" && user.plan.trim() !== "";

                if (
                    user &&
                    typeof user.provider === "string" &&
                    user.provider.toLowerCase() === provider.toLowerCase() &&
                    user.authToken &&
                    user.expirationTime > currentTime &&
                    hasValidPlan
                ) {
                    validUserId = userId;
                    removeLoadingIndicator();
                    break;
                }
            }
        }

        // 3️⃣ Handle result
        if (validUserId) {
            chrome.storage.local.set({ currentUser: validUserId }, () => {
                console.log("✅ Valid token and plan found. Restored session for:", validUserId);
                removeLoadingIndicator();
                showToast("Welcome back!", "success");
                callback(validUserId);
            });
        } else {
            console.log("❌ No valid session with plan found for provider:", provider);
            removeLoadingIndicator();
            callback(null);
        }
    });
}



async function activateBasicPlan(currentUserKey) {
    showLoadingIndicator();

    try {
        const response = await fetch('https://klikkfix-backend.onrender.com/api/activate_basic_plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentUserKey })
        });

        const data = await response.json();

        if (data.success) {
            await getCurrentUserPlan().then((syncedData) => {
                if (!syncedData) {
                    showToast("Basic plan expired", "error");
                    showUserPlanPage();
                } else {
                    showToast("🎉 Basic plan activated", "success");
                    showDashboard(currentUserKey.split(':')[0]);
                }
                removeLoadingIndicator();
            });            
        } else {
            throw new Error(data.error || "Failed to activate Basic plan.");
        }
    } catch (error) {
        removeLoadingIndicator();
        showToast("Could not activate Basic plan. Plan expired", 'error');
        console.error(error);
    }
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
    tabs.forEach(tab => tab.style.display = 'none');

    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.style.display = 'block';

    if (tabId === "subscription") {
        if (typeof showSlideFn === 'function') {
            showSlideFn(1); // ✅ Go to slide 2
        }
        animateProgressCircle();
    }
}
    

function animateProgressCircle(duration = 1000) {
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const containers = document.querySelectorAll('.subscriptionScope');
    //initializeSlider();

    if (containers.length === 0) return;

    getCurrentUserKey().then((userKey) => {
        if (!userKey) {
            console.log("No active session found.");
            return;
        }

        getUserData(userKey).then((profile) => {
            if (!profile) {
                console.log("User data not found for:", userKey);
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
                        valueText.innerHTML = `${current} / <tspan font-size="1.22em" dy="1.3">∞</tspan>`;
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
let debounceTimer = null;

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.users) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            getCurrentUserKey().then(userKey => {
                if (userKey && changes.users.newValue?.[userKey]) {
                    const updatedUser = changes.users.newValue[userKey];
                    animateProgressCircle();
                }
            });
        }, 300); // wait 300ms after last change
    }
});




let showSlideFn = null;

function initializeSlider() {
    const slider = document.getElementsByClassName('slider')[0];
    if (!slider) return;

    const track = slider.querySelector('.slider-track');
    const slides = slider.getElementsByClassName('slide');
    const indicators = slider.getElementsByClassName('nav-indicator');
    let currentSlide = 0;
    let autoSwitchInterval;

    function showSlide(index) {
        currentSlide = index;
        track.style.transform = `translateX(-${index * 100}%)`;
        for (let i = 0; i < indicators.length; i++) {
            indicators[i].classList.remove('active');
        }
        indicators[index].classList.add('active');
    }

    function startAutoSwitch() {
        clearInterval(autoSwitchInterval);
        autoSwitchInterval = setInterval(() => {
            currentSlide = (currentSlide + 1) % slides.length;
            showSlide(currentSlide);
        }, 35000);
    }

    for (let i = 0; i < indicators.length; i++) {
        indicators[i].addEventListener('click', () => {
            currentSlide = i;
            showSlide(currentSlide);
            startAutoSwitch();
        });
    }

    showSlide(1); // Start on slide 2
    startAutoSwitch();

    // ✅ Store globally
    showSlideFn = showSlide;
}

async function deleteProfile() {
    const confirmed = confirm(
        "⚠️ Are you sure you want to delete your profile?\n\n" +
        "This will immediately cancel your subscription and remove all local data."
    );
    if (!confirmed) return;

    chrome.storage.local.get(["users", "currentUser"], async (result) => {
        const { users = {}, currentUser } = result;

        if (!currentUser || !users[currentUser]) {
            return showToast("No active profile found to delete.", "info");
        }

        const user = users[currentUser];

        try {
            const response = await fetch('https://klikkfix-backend.onrender.com/api/delete_user_plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    provider: user.provider
                })
            });

            const data = await response.json();
            if (data.success) {
                console.log("✅ Plan reset in DB for user:", user.email);
            } else {
                console.log("⚠️ Could not reset plan in DB:", data.error);
            }
        } catch (err) {
            console.error("❌ Backend plan reset failed:", err);
        }

        // Reuse your helper
        deleteCurrentUserAndLogout();
    });
}

function deleteCurrentUserAndLogout() {
    chrome.storage.local.get(["users", "currentUser"], (result) => {
        const { users = {}, currentUser } = result;

        if (currentUser && users[currentUser]) {
            delete users[currentUser]; // ✅ Delete only this user's data

            chrome.storage.local.set({ users, currentUser: null }, () => {
                console.log(`✅ Deleted user '${currentUser}' and logged out.`);
                showToast("Your profile has been deleted.", "info");
                logoutUser(); // ✅ Clear UI, session, and reset app
            });
        } else {
            showToast("No active profile found.", "info");
            logoutUser(); // Just in case, force logout anyway
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
    if (typeof string !== "string" || string.length === 0) {
        return "";
    }
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}