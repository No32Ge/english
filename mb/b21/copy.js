
var errMassage = '';

// 复制到剪贴板的函数
async function copyToClipboard(id) {
    const output = document.getElementById(id);

    if (!output.innerHTML.trim()) {
        showMessage("无内容可复制");
        return;
    }

    if (errMassage != '') {
        showMessage("复制失败，格式有误");
        return;
    }
    const htmlContent = filter(output.innerHTML.replace(/\s+/g, ' ').trim());

    

    if (navigator.clipboard && window.ClipboardItem) {
        try {
            const blob = new Blob([htmlContent], { type: "text/html" });
            const item = new ClipboardItem({ "text/html": blob });

            await navigator.clipboard.write([item]);

            showMessage("新方法复制成功!");
            return;
        } catch (err) {
            // 写入失败则继续 fallback
        }
    }


    try {
        const tempElement = document.createElement("div");
        tempElement.style.position = "absolute";
        tempElement.style.left = "-9999px";
        tempElement.innerHTML = htmlContent;

        document.body.appendChild(tempElement);

        const range = document.createRange();
        range.selectNodeContents(tempElement);

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        document.execCommand("copy");

        selection.removeAllRanges();
        document.body.removeChild(tempElement);

        showMessage("旧方案复制成功!");
    } catch (err) {
        showMessage("复制失败 " + err);
    }
}


function filter(html) {
    const container = document.createElement('section');
    container.innerHTML = html;

    function replaceDiv(node) {
        node.childNodes.forEach(child => {
            if (child.nodeType === 1) {
                if (child.tagName.toLowerCase() === 'div') {
                    const section = document.createElement('section');
                    for (let attr of child.attributes) {
                        section.setAttribute(attr.name, attr.value);
                    }
                    while (child.firstChild) {
                        section.appendChild(child.firstChild);
                    }
                    child.replaceWith(section);
                    replaceDiv(section);
                } else {
                    replaceDiv(child);
                }
            }
        });
    }

    replaceDiv(container);

    const outer = document.createElement('div');
    outer.style.width = "800px";
    outer.style.margin = "0 auto";
    outer.style.boxSizing = "border-box";
 
    outer.appendChild(container);

    return outer.outerHTML; 
}


// 显示消息的函数
function showMessage(message) {
    const msgDiv = document.createElement("section");
    msgDiv.textContent = "Ge32提示：" + message;
    msgDiv.style.position = "fixed";
    msgDiv.style.top = "0";
    msgDiv.style.left = "50%";
    msgDiv.style.transform = "translateX(-50%)";
    msgDiv.style.backgroundColor = "rgba(3, 63, 173, 0.7)";
    msgDiv.style.color = "white";
    msgDiv.style.padding = "10px";
    msgDiv.style.zIndex = "1000";
    msgDiv.style.borderRadius = "15px";
    document.body.appendChild(msgDiv);
    setTimeout(() => {
        document.body.removeChild(msgDiv); // 1秒后移除消息
    }, 1000);
}

copyToClipboard("ge32")