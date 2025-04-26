// ==UserScript==
// @name         hook_localStorage_sessionStorage_getItem
// @version      2025-04-26
// @description  重写 localStorage.getItem 和 sessionStorage.getItem 方法，打印调用堆栈信息。
// @author       阿呆攻防
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Hook localStorage.getItem
    const originalLocalStorageGetItem = localStorage.getItem;
    localStorage.getItem = function(key) {
        console.log('localStorage.getItem called with key:', key);
        console.log(new Error().stack);
        console.log("-----------------------------------------------------------------------------------------------------");
        return originalLocalStorageGetItem.apply(localStorage, [key]);
    };

    // Hook sessionStorage.getItem
    const originalSessionStorageGetItem = sessionStorage.getItem;
    sessionStorage.getItem = function(key) {
        console.log('sessionStorage.getItem called with key:', key);
        console.log(new Error().stack);
        console.log("-----------------------------------------------------------------------------------------------------");
        return originalSessionStorageGetItem.apply(sessionStorage, [key]);
    };
})();