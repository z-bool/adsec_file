// ==UserScript==
// @name         modify_xhr_json_response
// @version      2025-04-26
// @description  拦截 XMLHttpRequest 请求，递归修改响应体 JSON 中多个指定字段的值，支持数组和嵌套对象，特殊处理 data 键值为 null 改为 {}。
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

    // 保存原始的 XMLHttpRequest.prototype.open
    const originalXHROpen = XMLHttpRequest.prototype.open;

    // 重写 open 方法，记录请求信息
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        this._xhrInfo = { method, url };
        return originalXHROpen.apply(this, arguments);
    };

    // 保存原始的 XMLHttpRequest.prototype.send
    const originalXHRSend = XMLHttpRequest.prototype.send;

    // 重写 send 方法，拦截响应
    XMLHttpRequest.prototype.send = function(body) {
        const xhr = this;

        // 添加 load 事件监听器
        xhr.addEventListener('load', function() {
            // 仅处理 JSON 响应
            if (xhr.getResponseHeader('Content-Type')?.includes('application/json')) {
                try {
                    // 获取原始响应
                    const originalResponse = xhr.responseText;
                    const jsonData = JSON.parse(originalResponse);

                    // 递归修改 JSON
                    const modifiedJson = modifyJsonRecursively(jsonData, MODIFY_CONFIG);

                    // 序列化修改后的 JSON
                    const modifiedResponseText = JSON.stringify(modifiedJson);

                    // 打印修改日志
                    console.log(`XHR [${xhr._xhrInfo.method} ${xhr._xhrInfo.url}] Modified JSON response`);

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
                    console.error(`Failed to modify JSON response for [${xhr._xhrInfo.method} ${xhr._xhrInfo.url}]:`, e);
                }
            }
        });

        // 调用原始 send 方法
        return originalXHRSend.apply(this, arguments);
    };
})();