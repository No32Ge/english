/**
 * ComponentLoader.js - V3.0 Zen Mode
 * 零构建、原生插槽支持、即时 DOM 解析
 */

const templateCache = new Map();

/**
 * 核心引擎：在组件实例化时直接绑定 DOM
 */
function initReactiveSystem(shadowRoot, scriptContent, host) {
    const data = {};
    const watchers = {};
    
    // 简单的发布订阅中心: key -> Set<NodeUpdater>
    const subscribers = new Map();

    // 1. 视图更新函数 (直接操作 DOM)
    const updateNode = (node, type, val, extra) => {
        if (type === 'text') node.textContent = val ?? '';
        else if (type === 'value') node.value = val ?? '';
        else if (type === 'show') node.style.display = val ? '' : 'none';
        else if (type === 'class') node.classList.toggle(extra, Boolean(val));
        else if (type === 'bind') node.setAttribute(extra, val ?? '');
    };

    // 2. 遍历 DOM 收集绑定 (Walk)
    // 不再预编译，直接在 Shadow DOM 里走一圈
    const walk = (node) => {
        if (node.nodeType === 1) { // Element
            // 处理 s- 属性
            Array.from(node.attributes).forEach(attr => {
                const name = attr.name;
                const prop = attr.value;
                
                let type = null;
                let extra = null;

                if (name === 's-text') type = 'text';
                else if (name === 's-value') type = 'value';
                else if (name === 's-show') type = 'show';
                else if (name === 's-model') type = 'model';
                else if (name.startsWith('s-bind:')) { type = 'bind'; extra = name.slice(7); }
                else if (name === 's-class') { type = 'class'; extra = prop; } // 简化：s-class="active" (对应 boolean)

                if (type) {
                    if (type === 'model') {
                        node.addEventListener('input', (e) => host._state[prop] = e.target.value);
                        // model 也是一种 value 绑定
                        if (!subscribers.has(prop)) subscribers.set(prop, new Set());
                        subscribers.get(prop).add(() => updateNode(node, 'value', host._state[prop]));
                    } 
                    else if (type === 'class') {
                         // s-class="className" -> 对应变量 className (true/false)
                         // 修正：通常 s-class="active" 绑定的是 isActive 变量
                         // 这里为了极简，我们约定 s-class="isActive:my-class" 或 s-class="isActive"
                         const [key, cls] = prop.split(':');
                         const className = cls || key;
                         if (!subscribers.has(key)) subscribers.set(key, new Set());
                         subscribers.get(key).add(() => updateNode(node, type, host._state[key], className));
                    }
                    else {
                        // 通用绑定
                        if (!subscribers.has(prop)) subscribers.set(prop, new Set());
                        subscribers.get(prop).add(() => updateNode(node, type, host._state[prop], extra));
                    }
                    
                    // 移除属性保持 DOM 干净
                    node.removeAttribute(name);
                }

                // 事件 s-on
                if (name.startsWith('s-on')) {
                    const [event, method] = prop.split(':');
                    node.addEventListener(event, (e) => {
                        if (host._methods[method]) host._methods[method](e);
                    });
                    node.removeAttribute(name);
                }
            });
        }
        // 递归
        node.childNodes.forEach(child => walk(child));
    };

    // 3. 响应式 Proxy
    const $state = new Proxy(data, {
        get(target, prop) { return target[prop]; },
        set(target, prop, value) {
            target[prop] = value;
            // 触发更新
            if (subscribers.has(prop)) {
                subscribers.get(prop).forEach(updater => updater());
            }
            // 触发 Watcher
            if (watchers[prop]) watchers[prop].forEach(cb => cb(value));
            return true;
        }
    });

    // 挂载到 host 以便外部访问
    host._state = $state;
    host._methods = {};

    // 4. 执行脚本
    if (scriptContent) {
        const $emit = (name, detail) => host.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
        const $watch = (key, cb) => {
            if (!watchers[key]) watchers[key] = [];
            watchers[key].push(cb);
        };
        // 简单直接的 API
        const runScript = new Function('$scope', '$host', '$state', '$methods', '$emit', '$watch', '$loader', 
            `"use strict";\n${scriptContent}`);
        
        const tools = { registerComponent, importHtml };
        runScript(shadowRoot, host, $state, host._methods, $emit, $watch, tools);
    }

    // 5. 启动扫描
    walk(shadowRoot);

    // 6. 初始化更新 (确保初始值正确渲染)
    subscribers.forEach((updaters, key) => {
        if ($state[key] !== undefined) updaters.forEach(fn => fn());
    });
}

// --- Exports ---

export async function importHtml(url) {
    if (templateCache.has(url)) return templateCache.get(url).content.cloneNode(true);
    const res = await fetch(url);
    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    const template = doc.querySelector('template');
    const style = doc.querySelector('style');
    
    const finalTemplate = document.createElement('template');
    if (style) finalTemplate.content.appendChild(style.cloneNode(true));
    if (template) finalTemplate.content.appendChild(template.content.cloneNode(true));
    else Array.from(doc.body.children).forEach(child => finalTemplate.content.appendChild(child)); // 无template兼容
    
    // 缓存包含 script 的元数据
    const script = doc.querySelector('script');
    const cacheData = { 
        content: finalTemplate.content, 
        scriptContent: script ? script.textContent : null 
    };
    templateCache.set(url, cacheData);
    
    return cacheData.content.cloneNode(true);
}

export function registerComponent(tagName, url) {
    if (customElements.get(tagName)) return;

    class CustomComponent extends HTMLElement {
        constructor() { super(); this.attachShadow({ mode: 'open' }); }

        async connectedCallback() {
            if (this.shadowRoot.firstChild) return;

            let cache = templateCache.get(url);
            if (!cache) {
                // 预加载缓存
                await importHtml(url); 
                cache = templateCache.get(url);
            }

            // 1. Clone DOM
            this.shadowRoot.appendChild(cache.content.cloneNode(true));

            // 2. Init
            initReactiveSystem(this.shadowRoot, cache.scriptContent, this);

            // 3. Props -> State 同步 (单向数据流)
            this.observer = new MutationObserver((mutations) => {
                mutations.forEach(m => {
                    if (m.type === 'attributes' && this._state) {
                        this._state[m.attributeName] = this.getAttribute(m.attributeName);
                    }
                });
            });
            this.observer.observe(this, { attributes: true });
            Array.from(this.attributes).forEach(attr => {
                 if (this._state) this._state[attr.name] = attr.value;
            });

            this.dispatchEvent(new Event('loaded'));
        }

        disconnectedCallback() {
            if (this.observer) this.observer.disconnect();
        }
    }
    customElements.define(tagName, CustomComponent);
}