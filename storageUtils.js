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

