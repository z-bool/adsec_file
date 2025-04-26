// ==UserScript==
// @name         force_xhr_status_200
// @version      2025-04-26
// @description  拦截所有 XMLHttpRequest 请求，强制将响应状态码设置为 200。
// @author       阿呆攻防
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 保存原始的 XMLHttpRequest.prototype.open
    const originalXHROpen = XMLHttpRequest.prototype.open;

    // 重写 open 方法，记录请求信息（可选，用于调试）
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        this._xhrInfo = { method, url }; // 存储请求信息
        return originalXHROpen.apply(this, arguments);
    };

    // 保存原始的 XMLHttpRequest.prototype.send
    const originalXHRSend = XMLHttpRequest.prototype.send;

    // 重写 send 方法，劫持响应状态
    XMLHttpRequest.prototype.send = function(body) {
        const xhr = this;

        // 添加 load 事件监听器
        xhr.addEventListener('load', function() {
            // 强制修改 status 属性
            Object.defineProperty(xhr, 'status', {
                get: function() {
                    console.log(`XHR [${xhr._xhrInfo.method} ${xhr._xhrInfo.url}] Original status: ${xhr.status}, Forced to: 200`);
                    return 200;
                },
                configurable: true
            });
        });

        // 调用原始 send 方法
        return originalXHRSend.apply(this, arguments);
    };
})();