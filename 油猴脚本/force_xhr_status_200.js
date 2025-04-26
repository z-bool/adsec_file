// ==UserScript==
// @name         force_all_status_200
// @version      2025-04-26
// @description  拦截所有 XMLHttpRequest 和 fetch 请求，强制将 JavaScript 中的状态码返回 200。
// @author       阿呆攻防
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- 拦截 XMLHttpRequest ---
    const OriginalXMLHttpRequest = window.XMLHttpRequest;

    function CustomXMLHttpRequest() {
        const xhr = new OriginalXMLHttpRequest();
        const xhrInfo = { method: '', url: '' };

        // 代理 open 方法以捕获请求信息
        const originalOpen = xhr.open;
        xhr.open = function(method, url, async, user, password) {
            xhrInfo.method = method;
            xhrInfo.url = url;
            return originalOpen.apply(this, arguments);
        };

        // 定义 status 属性，始终返回 200
        Object.defineProperty(xhr, 'status', {
            get: function() {
                const originalStatus = this._originalStatus !== undefined ? this._originalStatus : 0;
                console.log(`XHR [${xhrInfo.method} ${xhrInfo.url}] Original status: ${originalStatus}, Forced to: 200`);
                return 200;
            },
            configurable: true
        });

        // 捕获原始状态码
        xhr.addEventListener('readystatechange', function() {
            if (this.readyState === OriginalXMLHttpRequest.DONE) {
                try {
                    Object.defineProperty(this, '_originalStatus', {
                        value: this._originalStatus || this.status,
                        writable: false,
                        configurable: true
                    });
                } catch (e) {
                    console.warn('Failed to capture XHR original status:', e);
                }
            }
        });

        return new Proxy(xhr, {
            get(target, prop) {
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

    window.XMLHttpRequest = CustomXMLHttpRequest;

    // --- 拦截 fetch ---
    const originalFetch = window.fetch;

    window.fetch = async function(input, init) {
        const requestInfo = {
            method: init?.method || 'GET',
            url: typeof input === 'string' ? input : input.url
        };

        // 执行原始 fetch 请求
        const response = await originalFetch(input, init);

        // 创建一个新的 Response 对象，强制 status 为 200
        const customResponse = new Response(response.body, {
            status: 200,
            statusText: 'OK',
            headers: response.headers
        });

        // 保存原始状态码用于调试
        customResponse._originalStatus = response.status;

        // 使用 Proxy 拦截 response.status 的访问
        return new Proxy(customResponse, {
            get(target, prop) {
                if (prop === 'status') {
                    console.log(`Fetch [${requestInfo.method} ${requestInfo.url}] Original status: ${target._originalStatus}, Forced to: 200`);
                    return 200;
                }
                if (prop === 'ok') {
                    return true; // 强制 response.ok 为 true，表示成功
                }
                return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
            }
        });
    };
})();