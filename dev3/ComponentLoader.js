/**
 * ComponentLoader.js - V3.0 (Fixed & Verified)
 * 修复：按键点击无效的问题
 * 修复：防止语法错误导致页面空白
 */

console.log("ComponentLoader 正在加载..."); // 如果看不到这句话，说明文件没引对

const htmlCache = new Map();

/**
 * 核心引擎：运行时绑定
 */
function bindDOM(shadowRoot, $state, methods, host) {
    const allNodes = shadowRoot.querySelectorAll('*');

    allNodes.forEach(node => {
        // --- 1. 遍历属性，处理 s-text, s-model 等 ---
        // 注意：这里使用 Array.from 创建副本，防止移除属性时干扰遍历
        Array.from(node.attributes).forEach(attr => {
            const name = attr.name;
            const value = attr.value;

            // [重要修复] 遇到 s-on 和 s-model 先跳过，不要在这里处理，也不要删除
            // 留给后面的专用逻辑处理，否则事件还没绑上就被删了
            if (name === 's-on' || name === 's-model') return;

            if (name.startsWith('s-')) {
                const updateNode = () => {
                    // 获取数据 (支持 user.name 这种写法)
                    const val = value.split('.').reduce((obj, k) => (obj || {})[k], $state);

                    if (name === 's-text') node.textContent = val ?? '';
                    else if (name === 's-value') node.value = val ?? '';
                    else if (name === 's-show') node.style.display = val ? '' : 'none';
                    else if (name === 's-class') {
                        // 支持 s-class="isActive:my-class" 或 s-class="isActive"
                        const parts = value.split(':');
                        const propKey = parts[0];
                        const className = parts[1] || parts[0];
                        const realVal = propKey.split('.').reduce((obj, k) => (obj || {})[k], $state);
                        
                        if (realVal) node.classList.add(className);
                        else node.classList.remove(className);
                    }
                    else if (name.startsWith('s-bind:')) {
                        node.setAttribute(name.slice(7), val ?? '');
                    }
                };

                // 注册订阅
                const rootKey = value.split('.')[0];
                if (!host._subscribers[rootKey]) host._subscribers[rootKey] = new Set();
                host._subscribers[rootKey].add(updateNode);

                // 立即更新一次
                updateNode();

                // 移除已处理的指令 (s-bind 除外，因为它可能用于子组件)
                if (!name.startsWith('s-bind:')) node.removeAttribute(name);
            }
        });

        // --- 2. 事件绑定 (s-on) ---
        // 现在这里可以安全地获取 s-on 了
        if (node.hasAttribute('s-on')) {
            const [event, methodName] = node.getAttribute('s-on').split(':');
            node.addEventListener(event, (e) => {
                if (methods[methodName]) {
                    methods[methodName](e);
                } else {
                    console.error(`[ComponentLoader] 方法 "${methodName}" 未定义，请检查 script 标签`);
                }
            });
            node.removeAttribute('s-on');
        }

        // --- 3. 双向绑定 (s-model) ---
        if (node.hasAttribute('s-model')) {
            const prop = node.getAttribute('s-model');
            
            // 初始化值
            node.value = $state[prop] || '';
            
            // 监听输入 -> 改数据
            node.addEventListener('input', (e) => {
                $state[prop] = e.target.value;
            });

            // 订阅数据 -> 改输入框 (反向同步)
            const updateInput = () => {
                if (node.value !== $state[prop]) {
                    node.value = $state[prop] ?? '';
                }
            };
            if (!host._subscribers[prop]) host._subscribers[prop] = new Set();
            host._subscribers[prop].add(updateInput);
            
            node.removeAttribute('s-model');
        }
    });
}

// 导出 1: 导入原生 HTML
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

            try {
                // 加载 HTML
                let html = htmlCache.get(url);
                if (!html) {
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`无法加载组件: ${url}`);
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

                // 准备环境
                const data = {};
                const methods = {};
                
                const $state = new Proxy(data, {
                    get: (target, key) => target[key],
                    set: (target, key, value) => {
                        const oldVal = target[key];
                        target[key] = value;
                        // 触发视图更新
                        if (this._subscribers[key]) this._subscribers[key].forEach(fn => fn());
                        // 触发 Watcher
                        if (this._watchers[key]) this._watchers[key].forEach(cb => cb(value, oldVal));
                        return true;
                    }
                });

                const $emit = (name, detail) => this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
                const $watch = (key, cb) => {
                    if (!this._watchers[key]) this._watchers[key] = [];
                    this._watchers[key].push(cb);
                };

                // 为了方便调试，挂载到 host 上
                this._set = (key, val) => $state[key] = val;

                // 1. 先运行脚本 (确保 methods 被定义)
                if (scriptContent.trim()) {
                    const runScript = new Function('$scope', '$host', '$state', '$methods', '$emit', '$watch', '$loader',
                        `"use strict";\n${scriptContent}`);
                    runScript(this.shadowRoot, this, $state, methods, $emit, $watch, { registerComponent, importHtml });
                }

                // 2. 后绑定 DOM (此时 methods 已经存在)
                bindDOM(this.shadowRoot, $state, methods, this);

                // 3. Props 监听 (外部属性 -> 内部 state)
                this.observer = new MutationObserver((mutations) => {
                    mutations.forEach(m => {
                        if (m.type === 'attributes') $state[m.attributeName] = this.getAttribute(m.attributeName);
                    });
                });
                this.observer.observe(this, { attributes: true });
                Array.from(this.attributes).forEach(attr => $state[attr.name] = attr.value);

                this.dispatchEvent(new Event('loaded'));

            } catch (e) {
                console.error(`组件 ${tagName} 加载失败:`, e);
                this.shadowRoot.innerHTML = `<div style="color:red; border:1px solid red; padding:10px;">组件加载错误: ${e.message}</div>`;
            }
        }

        disconnectedCallback() {
            if (this.observer) this.observer.disconnect();
            this._subscribers = {};
            this._watchers = {};
        }
    }
    customElements.define(tagName, NativeComponent);
}