/**
 * ComponentLoader.js - V3.0 Final
 * 专注核心：原生 Slot 支持 + 极简响应式
 */

const htmlCache = new Map();

/**
 * 核心引擎：运行时绑定
 */
function bindDOM(shadowRoot, $state, methods, host) {
    // 1. 扫描所有元素
    const allNodes = shadowRoot.querySelectorAll('*');

    allNodes.forEach(node => {
        // --- 数据绑定 (s-text, s-show, s-class, s-bind) ---
        Array.from(node.attributes).forEach(attr => {
            const name = attr.name;
            const value = attr.value;

            if (name.startsWith('s-')) {
                const updateNode = () => {
                    // 支持 user.name 这种点语法
                    const val = value.split('.').reduce((obj, k) => (obj || {})[k], $state);

                    if (name === 's-text') node.textContent = val ?? '';
                    else if (name === 's-value') node.value = val ?? '';
                    else if (name === 's-show') node.style.display = val ? '' : 'none';
                    else if (name === 's-class') {
                        // 写法 s-class="isActive:my-class" 或 s-class="isActive" (类名同属性名)
                        const [prop, cls] = value.split(':');
                        const realVal = prop.split('.').reduce((obj, k) => (obj || {})[k], $state);
                        const className = cls || prop;
                        realVal ? node.classList.add(className) : node.classList.remove(className);
                    }
                    else if (name.startsWith('s-bind:')) {
                        node.setAttribute(name.slice(7), val ?? '');
                    }
                };

                // 简单的订阅模式
                const rootKey = value.split('.')[0];
                if (!host._subscribers[rootKey]) host._subscribers[rootKey] = new Set();
                host._subscribers[rootKey].add(updateNode);

                // 初始化执行
                updateNode();

                // s-bind 用于子组件通信，保留；其他指令移除以保持 DOM 干净
                if (!name.startsWith('s-bind:')) node.removeAttribute(name);
            }
        });

        // --- 事件绑定 (s-on) ---
        if (node.hasAttribute('s-on')) {
            const [event, methodName] = node.getAttribute('s-on').split(':');
            node.addEventListener(event, (e) => {
                if (methods[methodName]) methods[methodName](e);
                else console.warn(`方法 ${methodName} 未定义`);
            });
            node.removeAttribute('s-on');
        }

        // --- 双向绑定 (s-model) ---
        if (node.hasAttribute('s-model')) {
            const prop = node.getAttribute('s-model');
            node.value = $state[prop] || '';
            node.addEventListener('input', (e) => $state[prop] = e.target.value);

            const updateInput = () => { if (node.value !== $state[prop]) node.value = $state[prop] ?? ''; };
            if (!host._subscribers[prop]) host._subscribers[prop] = new Set();
            host._subscribers[prop].add(updateInput);
            node.removeAttribute('s-model');
        }
    });
}

// 导出 1: 导入原生 HTML 片段
export async function importHtml(url) {
    if (htmlCache.has(url)) return createTemplate(htmlCache.get(url));
    const res = await fetch(url);
    const text = await res.text();
    htmlCache.set(url, text);
    return createTemplate(text);
}

function createTemplate(html) {
    const t = document.createElement('template');
    t.innerHTML = html;
    return t.content.cloneNode(true);
}

// 导出 2: 注册组件
export function registerComponent(tagName, url) {
    if (customElements.get(tagName)) return;

    class NativeComponent extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
            this._subscribers = {};
            this._watchers = {};
        }

        async connectedCallback() {
            if (this.shadowRoot.innerHTML) return;

            // 加载 HTML
            let html = htmlCache.get(url);
            if (!html) {
                const res = await fetch(url);
                html = await res.text();
                htmlCache.set(url, html);
            }

            // 渲染
            const template = document.createElement('template');
            template.innerHTML = html;
            this.shadowRoot.appendChild(template.content.cloneNode(true));

            // 提取脚本
            const scriptEl = this.shadowRoot.querySelector('script');
            let scriptContent = '';
            if (scriptEl) {
                scriptContent = scriptEl.textContent;
                scriptEl.remove();
            }

            // 初始化系统
            const data = {};
            const methods = {};

            const $state = new Proxy(data, {
                get: (target, key) => target[key],
                set: (target, key, value) => {
                    const oldVal = target[key];
                    target[key] = value;
                    if (this._subscribers[key]) this._subscribers[key].forEach(fn => fn());
                    if (this._watchers[key]) this._watchers[key].forEach(cb => cb(value, oldVal));
                    return true;
                }
            });

            const $emit = (name, detail) => this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
            const $watch = (key, cb) => {
                if (!this._watchers[key]) this._watchers[key] = [];
                this._watchers[key].push(cb);
            };

            // 挂载 _set
            this._set = (key, val) => $state[key] = val;

            // ✅ 先执行脚本，保证 $methods 被填充
            try {
                const runScript = new Function('$scope', '$host', '$state', '$methods', '$emit', '$watch', '$loader',
                    `"use strict";\n${scriptContent}`);
                runScript(this.shadowRoot, this, $state, methods, $emit, $watch, { registerComponent, importHtml });
            } catch (e) { console.error(`Script Error in ${tagName}:`, e); }

            // ✅ 然后绑定 DOM，这样 s-on 可以正确找到 methods
            bindDOM(this.shadowRoot, $state, methods, this);

            // Props 监听
            this.observer = new MutationObserver((mutations) => {
                mutations.forEach(m => {
                    if (m.type === 'attributes') $state[m.attributeName] = this.getAttribute(m.attributeName);
                });
            });
            this.observer.observe(this, { attributes: true });
            Array.from(this.attributes).forEach(attr => $state[attr.name] = attr.value);

            this.dispatchEvent(new Event('loaded'));
        }


        disconnectedCallback() {
            if (this.observer) this.observer.disconnect();
            this._subscribers = {};
            this._watchers = {};
        }
    }
    customElements.define(tagName, NativeComponent);
}