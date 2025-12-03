/**
 * ComponentLoader.js - 最终全能版
 */
const templateCache = new Map();

function initReactiveSystem(shadowRoot, userScriptContent, host) {
    const bindings = {};
    const data = {};
    const watchers = {};

    const updateView = (key, value) => {
        if (!bindings[key]) return;
        bindings[key].forEach(node => {
            if (node.hasAttribute('s-text')) node.textContent = value;
            if (node.hasAttribute('s-value')) node.value = value;
            if (node.hasAttribute('s-show')) node.style.display = value ? '' : 'none';
            if (node.hasAttribute('s-class')) {
                const className = node.getAttribute('s-class');
                value ? node.classList.add(className) : node.classList.remove(className);
            }
            // s-bind:attr
            Array.from(node.attributes).forEach(attr => {
                if (attr.name.startsWith('s-bind:')) {
                    const targetAttr = attr.name.replace('s-bind:', '');
                    node.setAttribute(targetAttr, value);
                }
            });
        });
    };

    const $state = new Proxy(data, {
        get(target, prop) { return target[prop]; },
        set(target, prop, value) {
            const oldValue = target[prop];
            target[prop] = value;
            updateView(prop, value);
            if (watchers[prop]) watchers[prop].forEach(cb => cb(value, oldValue));
            return true;
        }
    });

    const scanDOM = () => {
        const allNodes = shadowRoot.querySelectorAll('*');
        allNodes.forEach(node => {
            ['s-text', 's-value', 's-show', 's-class', 's-model'].forEach(attr => {
                if (node.hasAttribute(attr)) {
                    const key = node.getAttribute(attr);
                    if (!bindings[key]) bindings[key] = [];
                    bindings[key].push(node);
                    if (attr === 's-model') node.addEventListener('input', (e) => $state[key] = e.target.value);
                }
            });
            Array.from(node.attributes).forEach(attr => {
                if (attr.name.startsWith('s-bind:')) {
                    const key = attr.value;
                    if (!bindings[key]) bindings[key] = [];
                    bindings[key].push(node);
                }
            });
            if (node.hasAttribute('s-on')) {
                const [event, method] = node.getAttribute('s-on').split(':');
                node.addEventListener(event, (e) => {
                    const $emit = (name, detail) => host.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
                    if ($state[method]) $state[method](e, { $emit });
                });
            }
        });
    };

    scanDOM();
    host._updateState = (key, value) => { $state[key] = value; };

    if (userScriptContent) {
        const tools = { registerComponent, importHtml };
        const $emit = (name, detail) => host.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
        const $watch = (key, callback) => {
            if (!watchers[key]) watchers[key] = [];
            watchers[key].push(callback);
            if ($state[key] !== undefined) callback($state[key]); 
        };
        const runScript = new Function('$scope', '$host', '$loader', '$state', '$emit', '$watch', userScriptContent);
        runScript(shadowRoot, host, tools, $state, $emit, $watch);
    }
}

function createNodeFromHtml(htmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const template = doc.querySelector('template');
    const style = doc.querySelector('style');
    const script = doc.querySelector('script');
    const fragment = document.createDocumentFragment();
    if (style) fragment.appendChild(style.cloneNode(true));
    if (template) { fragment.appendChild(template.content.cloneNode(true)); } 
    else { Array.from(doc.body.children).forEach(child => fragment.appendChild(child)); }
    fragment._scriptContent = script ? script.textContent : null;
    return fragment;
}

// 导出 1: 导入原生 HTML (返回 Node)
export async function importHtml(url) {
    if (templateCache.has(url)) return createNodeFromHtml(templateCache.get(url));
    const res = await fetch(url);
    const text = await res.text();
    templateCache.set(url, text);
    return createNodeFromHtml(text);
}

// 导出 2: 注册 Web Component
export function registerComponent(tagName, url) {
    if (customElements.get(tagName)) return;
    class CustomComponent extends HTMLElement {
        constructor() { super(); this.attachShadow({ mode: 'open' }); }
        async connectedCallback() {
            if (this.shadowRoot.innerHTML) return;
            try {
                let htmlText = templateCache.get(url);
                if (!htmlText) { const res = await fetch(url); htmlText = await res.text(); templateCache.set(url, htmlText); }
                const fragment = createNodeFromHtml(htmlText);
                const scriptContent = fragment._scriptContent;
                this.shadowRoot.appendChild(fragment);
                initReactiveSystem(this.shadowRoot, scriptContent, this);
                this.observer = new MutationObserver((mutations) => {
                    mutations.forEach(mutation => {
                        if (mutation.type === 'attributes') {
                            const name = mutation.attributeName;
                            const value = this.getAttribute(name);
                            if (this._updateState) this._updateState(name, value);
                        }
                    });
                });
                this.observer.observe(this, { attributes: true });
                Array.from(this.attributes).forEach(attr => { if (this._updateState) this._updateState(attr.name, attr.value); });
                this.dispatchEvent(new Event('loaded'));
            } catch (e) { console.error(e); }
        }
        disconnectedCallback() { if (this.observer) this.observer.disconnect(); }
    }
    customElements.define(tagName, CustomComponent);
}