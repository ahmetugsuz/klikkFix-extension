export const UserPlans = Object.freeze({
    basic: 25,
    pro: 50,
    premium: Infinity
});

export function getCurrentUserKey() {
        // returns user key = {provider:email}
    return new Promise((resolve) => {
        chrome.storage.local.get(["currentUser"], (result) => {
            resolve(result.currentUser || null);
        });
    });
}

export function getUserData(userKey) {
    return new Promise((resolve) => {
        chrome.storage.local.get(["users"], (result) => {
            const user = result.users?.[userKey] || null;
            resolve(user);
        });
    });
}

export function getCurrentPlan(userKey){
    return new Promise((resolve) => {
        chrome.storage.local.get(["users"], (result) => {
            const user = result.users?.[userKey] || null;
            resolve(user.plan);
        });
    });
}

export function getUserUsageCount(userKey, callback) {
    chrome.storage.local.get(["users"], (result) => {
        const users = result.users || {};
        const user = users[userKey]; // current user
        const usageCount = user ? user.usageCount || 0 : 0;
        callback(usageCount);
    });
}

export function isSessionExpired(userKey) {
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


export function isPlanExpired(userKey){
    return new Promise((resolve) => {
        chrome.storage.local.get(["users"], (result) => {
            const user = result.users?.[userKey];

            const currentTime = Date.now();
            const expiresAt = new Date(user?.plan_expires_at).getTime();
            const isValid = !isNaN(expiresAt);
            
            if (user && isValid && expiresAt > currentTime) {
                resolve(false);  // ✅ Not expired
            } else {
                if (user.plan?.toLowerCase() === 'basic'){
                    resolve(true);   // ❌ Expired or not found
                }
                else{
                    resolve(false)
                }
            }
        });
    });
}

export function checkUsageLimit(userData) {
    const { plan, usageCount = 0 } = userData;

    let limit;

    switch (plan?.toLowerCase()) {
        case "pro":
            limit = UserPlans.pro;
            break;
        case "premium":
            limit = UserPlans.premium;
            break;
        case "basic":
        case "free":
        default:
            limit = UserPlans.basic;
    }

    return limit === Infinity || usageCount < limit;
}

export function userRequestLimit(plan) {
    switch (plan?.toLowerCase()) {
        case "pro":
            return UserPlans.pro;
        case "premium":
            return UserPlans.premium;
        case "basic":
        case "free":
        default:
            return UserPlans.basic;
    }
}

