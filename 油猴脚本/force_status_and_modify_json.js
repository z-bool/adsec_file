// ==UserScript==
    // @name         combined_xhr_fetch_modifier
    // @version      2025-04-26
    // @description  拦截 XMLHttpRequest 和 fetch 请求，强制状态码为 200，并递归修改响应体 JSON 中指定字段的值，支持数组和嵌套对象，特殊处理 data 键值为 null 改为 {}。
    // @author       阿呆攻防
    // @match        *://*/*
    // @grant        none
    // ==/UserScript==

    (function() {
        'use strict';

        // 配置：要修改的字段和目标值（支持多个）
        const MODIFY_CONFIG = [
            { field: 'success', newValue: '1' },
            { field: 'errorCode', newValue: "" },
        ];

        // 递归修改 JSON 中的指定字段
        function modifyJsonRecursively(data, config) {
            if (!data || typeof data !== 'object') {
                return data;
            }

            // 处理数组
            if (Array.isArray(data)) {
                return data.map(item => modifyJsonRecursively(item, config));
            }

            // 处理对象
            const result = { ...data };
            for (const key in result) {
                if (Object.prototype.hasOwnProperty.call(result, key)) {
                    // 特殊处理：当 key 为 'data' 且值为 null 时，改为 {}
                    if (key === 'data' && result[key] === null) {
                        console.log(`Modifying field "${key}" from null to {}`);
                        result[key] = {};
                    } else {
                        // 检查是否需要修改当前键
                        const configItem = config.find(item => item.field === key);
                        if (configItem) {
                            console.log(`Modifying field "${key}" from "${result[key]}" to "${configItem.newValue}"`);
                            result[key] = configItem.newValue;
                        } else {
                            // 递归处理嵌套对象或数组
                            result[key] = modifyJsonRecursively(result[key], config);
                        }
                    }
                }
            }
            return result;
        }

        // --- 拦截 XMLHttpRequest ---
        const OriginalXMLHttpRequest = window.XMLHttpRequest;

        function CustomXMLHttpRequest() {
            const xhr = new OriginalXMLHttpRequest();
            const xhrInfo = { method: '', url: '' };

            // 代理 open 方法以捕获请求信息
            const originalOpen = xhr.open;
            xhr.open = function(method, url, async, user, password) {
                xhrInfo.method = method || 'GET';
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

            // 捕获原始状态码并修改 JSON 响应
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

            // 拦截 load 事件以修改 JSON 响应
            xhr.addEventListener('load', function() {
                if (xhr.getResponseHeader('Content-Type')?.includes('application/json')) {
                    try {
                        const originalResponse = xhr.responseText;
                        const jsonData = JSON.parse(originalResponse);
                        const modifiedJson = modifyJsonRecursively(jsonData, MODIFY_CONFIG);
                        const modifiedResponseText = JSON.stringify(modifiedJson);

                        console.log(`XHR [${xhrInfo.method} ${xhrInfo.url}] Modified JSON response`);

                        // 劫持 response 和 responseText 属性
                        Object.defineProperty(xhr, 'responseText', {
                            get: function() {
                                return modifiedResponseText;
                            },
                            configurable: true
                        });
                        Object.defineProperty(xhr, 'response', {
                            get: function() {
                                return modifiedResponseText;
                            },
                            configurable: true
                        });
                    } catch (e) {
                        console.error(`Failed to modify JSON response for [${xhrInfo.method} ${xhrInfo.url}]:`, e);
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
                method: 'GET',
                url: ''
            };

            if (typeof input === 'string') {
                requestInfo.url = input;
            } else if (input instanceof Request) {
                requestInfo.url = input.url;
                requestInfo.method = input.method || 'GET';
            }

            if (init && init.method) {
                requestInfo.method = init.method.toUpperCase();
            }

            const response = await originalFetch(input, init);

            // 读取原始响应体
            const originalBody = await response.text();
            let modifiedBody = originalBody;

            // 处理 JSON 响应
            if (response.headers.get('Content-Type')?.includes('application/json')) {
                try {
                    const jsonData = JSON.parse(originalBody);
                    const modifiedJson = modifyJsonRecursively(jsonData, MODIFY_CONFIG);
                    modifiedBody = JSON.stringify(modifiedJson);
                    console.log(`Fetch [${requestInfo.method} ${requestInfo.url}] Modified JSON response`);
                } catch (e) {
                    console.error(`Failed to modify JSON response for [${requestInfo.method} ${requestInfo.url}]:`, e);
                }
            }

            // 创建新的 Response 对象，强制 status 为 200
            const customResponse = new Response(modifiedBody, {
                status: 200,
                statusText: 'OK',
                headers: response.headers
            });

            customResponse._originalStatus = response.status;

            return new Proxy(customResponse, {
                get(target, prop) {
                    if (prop === 'status') {
                        console.log(`Fetch [${requestInfo.method} ${requestInfo.url}] Original status: ${target._originalStatus}, Forced to: 200`);
                        return 200;
                    }
                    if (prop === 'ok') {
                        return true;
                    }
                    return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
                }
            });
        };
    })();