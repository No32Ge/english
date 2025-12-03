/**
 * ComponentLoader.js - V2.0 (高性能编译版)
 */

const componentCache = new Map(); // 缓存编译后的模板和指令

/**
 * 核心工具：深层对象访问 (支持 user.name)
 */
function getDeepValue(obj, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

/**
 * 阶段 1: 编译器 (Compile Phase)
 * 只在第一次加载 HTML 时执行。它会扫描模板，提取所有指令，并生成一份“说明书”。
 */
function compileTemplate(htmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const template = doc.querySelector('template');
    const style = doc.querySelector('style');
    const script = doc.querySelector('script');

    // 如果没有 template，尝试把 body 内容当模板
    const content = template ? template.content : doc.body;
    
    // 绑定指令集： { "uid-1": [ { type: 'text', prop: 'count' } ] }
    const bindings = {}; 
    let uidCounter = 0;

    // 递归遍历模板，提取所有 s- 指令
    // 这是一个“脏活”，但只做一次
    function traverse(node) {
        if (node.nodeType === 1) { // 元素节点
            let hasBinding = false;
            const nodeId = `s-${uidCounter++}`;
            const nodeInstructions = [];

            // 检查属性
            Array.from(node.attributes).forEach(attr => {
                const name = attr.name;
                const value = attr.value;

                if (name.startsWith('s-')) {
                    hasBinding = true;
                    // 记录指令
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
                    
                    // 编译期移除指令属性（保持 DOM 干净）
                    node.removeAttribute(name);
                }
            });

            if (hasBinding) {
                // 给模板里的节点打上标记，方便实例化时直接找到
                node.setAttribute('data-s-id', nodeId);
                bindings[nodeId] = nodeInstructions;
            }
        }
        
        // 继续遍历子节点
        node.childNodes.forEach(child => traverse(child));
    }

    traverse(content);

    return {
        templateFragment: content,
        styleNode: style,
        scriptContent: script ? script.textContent : null,
        bindings: bindings // 这就是“说明书”
    };
}

/**
 * 阶段 2: 响应式核心 (Reactive Core)
 */
function initReactor(shadowRoot, compiledData, host) {
    const { bindings, scriptContent } = compiledData;
    
    // 1. 快速查找节点 (不再全树扫描，而是精确查找)
    // nodesMap: { "s-0": Node, "s-1": Node }
    const nodesMap = {};
    shadowRoot.querySelectorAll('[data-s-id]').forEach(node => {
        nodesMap[node.getAttribute('data-s-id')] = node;
    });

    const data = {};      // 纯数据
    const methods = {};   // 方法集合
    const watchers = {};  // 监听器

    // 2. 批量更新队列 (性能优化的关键)
    let isPending = false;
    const dirtyKeys = new Set();

    const flushUpdate = () => {
        dirtyKeys.forEach(key => {
            const val = getDeepValue(data, key);
            
            // 触发 Watcher
            if (watchers[key]) watchers[key].forEach(cb => cb(val));

            // 更新 DOM
            // 这里我们需要一种反向查找：哪个 key 对应哪些节点？
            // 为了简单，我们遍历 bindings (因为 bindings 数量通常比 DOM 节点少得多)
            // *高级优化是建立 key->nodes 的依赖图，这里先用 V1.5 级别的遍历指令
            Object.entries(bindings).forEach(([nodeId, instructions]) => {
                const node = nodesMap[nodeId];
                if (!node) return;

                instructions.forEach(instr => {
                    // 只有当指令绑定的 prop 匹配当前变更的 key 时才更新
                    // 简单支持 'user.name' 匹配 'user'
                    if (instr.prop === key || (instr.prop && instr.prop.startsWith(key + '.')) || key.startsWith(instr.prop + '.')) {
                        const currentVal = getDeepValue(data, instr.prop);
                        
                        switch (instr.type) {
                            case 'text': node.textContent = currentVal; break;
                            case 'html': node.innerHTML = currentVal; break;
                            case 'value': node.value = currentVal; break;
                            case 'show': node.style.display = currentVal ? '' : 'none'; break;
                            case 'class': currentVal ? node.classList.add(instr.prop) : node.classList.remove(instr.prop); break; // 修正 class 逻辑需改进，暂简略
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
            // 微任务：在当前 JS 执行完后，浏览器渲染前执行
            queueMicrotask(flushUpdate);
        }
    };

    // 3. 代理 State
    const $state = new Proxy(data, {
        get(target, prop) { return target[prop]; },
        set(target, prop, value) {
            if (target[prop] === value) return true;
            target[prop] = value;
            queueUpdate(prop); // 放入更新队列
            return true;
        }
    });

    // 4. 事件与初始化
    // 绑定事件 (s-on) 和双向绑定 (s-model)
    Object.entries(bindings).forEach(([nodeId, instructions]) => {
        const node = nodesMap[nodeId];
        if (!node) return;

        instructions.forEach(instr => {
            if (instr.type === 'model') {
                node.addEventListener('input', (e) => $state[instr.prop] = e.target.value);
            } else if (instr.type === 'on') {
                node.addEventListener(instr.event, (e) => {
                    // 方法现在在 methods 对象里找
                    if (methods[instr.method]) methods[instr.method](e);
                    else console.warn(`Method ${instr.method} not found.`);
                });
            }
        });
    });

    // 5. 执行用户脚本
    if (scriptContent) {
        const $emit = (name, detail) => host.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
        const $watch = (key, cb) => {
            if (!watchers[key]) watchers[key] = [];
            watchers[key].push(cb);
        };
        
        // 构造沙箱
        // 注意：我们把 methods 暴露出去让用户填充
        const runScript = new Function('$scope', '$host', '$state', '$methods', '$emit', '$watch', '$loader', scriptContent);
        
        const tools = { registerComponent, importHtml };
        runScript(shadowRoot, host, $state, methods, $emit, $watch, tools);
    }
    
    // 暴露更新接口给父组件 (Props Down)
    host._updateState = (key, value) => {
        $state[key] = value;
    };
}

// --- 导出方法 ---

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

            // 1. 获取并编译 (带缓存)
            let compiled = componentCache.get(url);
            if (!compiled) {
                const res = await fetch(url);
                const text = await res.text();
                compiled = compileTemplate(text);
                componentCache.set(url, compiled);
            }

            // 2. 克隆模板 (极快)
            if (compiled.styleNode) this.shadowRoot.appendChild(compiled.styleNode.cloneNode(true));
            this.shadowRoot.appendChild(compiled.templateFragment.cloneNode(true));

            // 3. 初始化响应式 (极快，无全扫描)
            initReactor(this.shadowRoot, compiled, this);

            // 4. Props 监听
            this.observer = new MutationObserver((mutations) => {
                mutations.forEach(m => {
                    if (m.type === 'attributes' && this._updateState) {
                        this._updateState(m.attributeName, this.getAttribute(m.attributeName));
                    }
                });
            });
            this.observer.observe(this, { attributes: true });
            
            // 初始 Props 同步
            Array.from(this.attributes).forEach(attr => {
                if (this._updateState) this._updateState(attr.name, attr.value);
            });
        }
        
        disconnectedCallback() {
            if (this.observer) this.observer.disconnect();
            // 这里未来可以添加内存清理逻辑
        }
    }
    customElements.define(tagName, CustomComponent);
}