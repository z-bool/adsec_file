// ==UserScript==
// @name         force_xhr_status_200
// @version      2025-04-26
// @description  拦截所有 XMLHttpRequest 请求，强制将 JavaScript 中 xhr.status 返回 200。
// @author       阿呆攻防
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 保存原始的 XMLHttpRequest
    const OriginalXMLHttpRequest = window.XMLHttpRequest;

    // 创建一个新的 XMLHttpRequest 包装类
    function CustomXMLHttpRequest() {
        const xhr = new OriginalXMLHttpRequest();
        const xhrInfo = { method: '', url: '' }; // 用于调试信息

        // 代理 open 方法以捕获请求信息
        const originalOpen = xhr.open;
        xhr.open = function(method, url, async, user, password) {
            xhrInfo.method = method;
            xhrInfo.url = url;
            return originalOpen.apply(this, arguments);
        };

        // 定义一个只读的 status 属性，始终返回 200
        Object.defineProperty(xhr, 'status', {
            get: function() {
                const originalStatus = this._originalStatus !== undefined ? this._originalStatus : 0;
                console.log(`XHR [${xhrInfo.method} ${xhrInfo.url}] Original status: ${originalStatus}, Forced to: 200`);
                return 200;
            },
            configurable: true
        });

        // 监听 readyStateChange 事件以捕获原始状态码
        xhr.addEventListener('readystatechange', function() {
            if (this.readyState === OriginalXMLHttpRequest.DONE) {
                // 保存原始状态码（用于调试）
                try {
                    Object.defineProperty(this, '_originalStatus', {
                        value: this._originalStatus || this.status,
                        writable: false,
                        configurable: true
                    });
                } catch (e) {
                    console.warn('Failed to capture original status:', e);
                }
            }
        });

        // 代理其他属性和方法，确保正常功能
        return new Proxy(xhr, {
            get(target, prop) {
                // 确保 status 属性始终返回 200
                if (prop === 'status') {
                    return 200;
                }
                return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
            },
            set(target, prop, value) {
                target[prop] = value;
                return true;
            }
        });
    }

    // 替换全局 XMLHttpRequest
    window.XMLHttpRequest = CustomXMLHttpRequest;
})();