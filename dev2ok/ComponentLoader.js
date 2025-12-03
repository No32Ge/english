/**
 * ComponentLoader.js - V2.1 (修复对象更新 Bug)
 */
const componentCache = new Map();

// 工具：深层对象访问
function getDeepValue(obj, path) {
    if (!path) return undefined;
    const val = path.split('.').reduce((acc, part) => acc && acc[part], obj);
    return val === undefined ? '' : val; // 防止显示 undefined
}

// 阶段 1: 编译器 (保持不变)
function compileTemplate(htmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const template = doc.querySelector('template');
    const style = doc.querySelector('style');
    const script = doc.querySelector('script');
    const content = template ? template.content : doc.body;
    
    const bindings = {}; 
    let uidCounter = 0;

    function traverse(node) {
        if (node.nodeType === 1) {
            let hasBinding = false;
            const nodeId = `s-${uidCounter++}`;
            const nodeInstructions = [];

            Array.from(node.attributes).forEach(attr => {
                const name = attr.name;
                const value = attr.value;
                if (name.startsWith('s-')) {
                    hasBinding = true;
                    if (name === 's-text') nodeInstructions.push({ type: 'text', prop: value });
                    else if (name === 's-html') nodeInstructions.push({ type: 'html', prop: value });
                    else if (name === 's-value') nodeInstructions.push({ type: 'value', prop: value });
                    else if (name === 's-model') nodeInstructions.push({ type: 'model', prop: value });
                    else if (name === 's-show') nodeInstructions.push({ type: 'show', prop: value });
                    else if (name === 's-class') nodeInstructions.push({ type: 'class', prop: value });
                    else if (name.startsWith('s-bind:')) nodeInstructions.push({ type: 'bind', attr: name.slice(7), prop: value });
                    else if (name.startsWith('s-on')) {
                        const [event, method] = value.split(':');
                        nodeInstructions.push({ type: 'on', event, method });
                    }
                    node.removeAttribute(name);
                }
            });
            if (hasBinding) {
                node.setAttribute('data-s-id', nodeId);
                bindings[nodeId] = nodeInstructions;
            }
        }
        node.childNodes.forEach(child => traverse(child));
    }
    traverse(content);

    return {
        templateFragment: content,
        styleNode: style,
        scriptContent: script ? script.textContent : null,
        bindings: bindings
    };
}

// 阶段 2: 响应式核心 (修复了 Proxy 逻辑)
function initReactor(shadowRoot, compiledData, host) {
    const { bindings, scriptContent } = compiledData;
    const nodesMap = {};
    shadowRoot.querySelectorAll('[data-s-id]').forEach(node => {
        nodesMap[node.getAttribute('data-s-id')] = node;
    });

    const data = {};
    const methods = {};
    const watchers = {};

    let isPending = false;
    const dirtyKeys = new Set();

    const flushUpdate = () => {
        dirtyKeys.forEach(key => {
            const val = getDeepValue(data, key);
            if (watchers[key]) watchers[key].forEach(cb => cb(val));

            Object.entries(bindings).forEach(([nodeId, instructions]) => {
                const node = nodesMap[nodeId];
                if (!node) return;
                instructions.forEach(instr => {
                    // 匹配逻辑：比如 key='user' 更新了，那么 'user.name' 和 'user.age' 都要更新
                    if (instr.prop === key || (instr.prop && instr.prop.startsWith(key + '.')) || key.startsWith(instr.prop + '.')) {
                        const currentVal = getDeepValue(data, instr.prop);
                        switch (instr.type) {
                            case 'text': node.textContent = currentVal; break;
                            case 'html': node.innerHTML = currentVal; break;
                            case 'value': node.value = currentVal; break;
                            case 'show': node.style.display = currentVal ? '' : 'none'; break;
                            case 'class': currentVal ? node.classList.add(instr.prop) : node.classList.remove(instr.prop); break;
                            case 'bind': node.setAttribute(instr.attr, currentVal); break;
                        }
                    }
                });
            });
        });
        dirtyKeys.clear();
        isPending = false;
    };

    const queueUpdate = (key) => {
        dirtyKeys.add(key);
        if (!isPending) {
            isPending = true;
            queueMicrotask(flushUpdate);
        }
    };

    // [关键修复] Proxy 不再拦截相同引用的对象更新
    const $state = new Proxy(data, {
        get(target, prop) { return target[prop]; },
        set(target, prop, value) {
            // 删除之前的 === 检查，强制触发更新
            target[prop] = value;
            queueUpdate(prop); 
            return true;
        }
    });

    Object.entries(bindings).forEach(([nodeId, instructions]) => {
        const node = nodesMap[nodeId];
        if (!node) return;
        instructions.forEach(instr => {
            if (instr.type === 'model') {
                node.addEventListener('input', (e) => $state[instr.prop] = e.target.value);
            } else if (instr.type === 'on') {
                node.addEventListener(instr.event, (e) => {
                    if (methods[instr.method]) methods[instr.method](e);
                    else console.error(`Method "${instr.method}" not found in $methods.`);
                });
            }
        });
    });

    if (scriptContent) {
        const $emit = (name, detail) => host.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
        const $watch = (key, cb) => {
            if (!watchers[key]) watchers[key] = [];
            watchers[key].push(cb);
        };
        // 构造沙箱
        const runScript = new Function('$scope', '$host', '$state', '$methods', '$emit', '$watch', '$loader', scriptContent);
        const tools = { registerComponent, importHtml };
        runScript(shadowRoot, host, $state, methods, $emit, $watch, tools);
    }
    
    host._updateState = (key, value) => { $state[key] = value; };
}

export async function importHtml(url) {
    if (componentCache.has(url)) {
        const cache = componentCache.get(url);
        const frag = document.createDocumentFragment();
        if (cache.styleNode) frag.appendChild(cache.styleNode.cloneNode(true));
        frag.appendChild(cache.templateFragment.cloneNode(true));
        return frag;
    }
    const res = await fetch(url);
    const text = await res.text();
    const compiled = compileTemplate(text);
    componentCache.set(url, compiled);
    const frag = document.createDocumentFragment();
    if (compiled.styleNode) frag.appendChild(compiled.styleNode.cloneNode(true));
    frag.appendChild(compiled.templateFragment.cloneNode(true));
    return frag;
}

export function registerComponent(tagName, url) {
    if (customElements.get(tagName)) return;
    class CustomComponent extends HTMLElement {
        constructor() { super(); this.attachShadow({ mode: 'open' }); }
        async connectedCallback() {
            if (this.shadowRoot.innerHTML) return;
            let compiled = componentCache.get(url);
            if (!compiled) {
                const res = await fetch(url);
                const text = await res.text();
                compiled = compileTemplate(text);
                componentCache.set(url, compiled);
            }
            if (compiled.styleNode) this.shadowRoot.appendChild(compiled.styleNode.cloneNode(true));
            this.shadowRoot.appendChild(compiled.templateFragment.cloneNode(true));
            initReactor(this.shadowRoot, compiled, this);
            
            this.observer = new MutationObserver((mutations) => {
                mutations.forEach(m => {
                    if (m.type === 'attributes' && this._updateState) {
                        this._updateState(m.attributeName, this.getAttribute(m.attributeName));
                    }
                });
            });
            this.observer.observe(this, { attributes: true });
            Array.from(this.attributes).forEach(attr => {
                if (this._updateState) this._updateState(attr.name, attr.value);
            });
        }
        disconnectedCallback() { if (this.observer) this.observer.disconnect(); }
    }
    customElements.define(tagName, CustomComponent);
}