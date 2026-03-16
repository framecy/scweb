import { createEditor } from './editor.js'

document.fonts.ready.then(() => {
  document.body.dataset.show = ''
})

const el_result = document.querySelector('#result')
const el_copy = document.querySelector('#copy')
const el_clash = document.querySelector('#clash')
const el_editor = document.querySelector('#editor')
let editorView, rulesEditorView
const initialContent = location.hash.slice(1) || ''
const initialRules = localStorage.getItem('remote_rules') || ''

function getAPIBase() {
  return new URL(`http://${location.hostname}:8000/`)
}

// Initial result URL
el_result.value = getAPIBase().href

const el_dns_toggle = document.querySelector('#dnsToggle')
const el_tun_toggle = document.querySelector('#tunToggle')

let timeout_id_update
// Rename to avoid confusion and use as a stable reference

function updateURL(view) {
  const contentInput = (editorView ? editorView.state.doc.toString() : initialContent).trim()
  const rulesInput = (rulesEditorView ? rulesEditorView.state.doc.toString() : initialRules).trim()
  localStorage.setItem('remote_rules', rulesInput)

  if (!contentInput) {
    el_result.value = ''
    return
  }

  // Restore robust processing of content sources
  const sources = contentInput.split(/\s*\n\s*/g).filter(Boolean)
  let formattedContent = ''
  
  if (sources.length === 1 && /^(?:https?|data):/i.test(sources[0])) {
    // Single plain URL - keep it simple
    formattedContent = sources[0]
  } else {
    // Multi-line or complex format - join and escape
    formattedContent = sources.join('|')
      .replaceAll('%', '%25')
      .replaceAll('\\', '%5C')
      .replace(/^(https?|data):/i, '$1%3A')
  }

  const base = getAPIBase()
  const searchParams = base.searchParams
  if (!el_dns_toggle.checked) searchParams.set('dns', 'false')
  if (!el_tun_toggle.checked) searchParams.set('tun', 'false')
  if (rulesInput) searchParams.set('rules', rulesInput)

  const args = searchParams.toString()
  let resultURL = base.origin
  if (args) {
    resultURL += '/!' + args
  }
  resultURL += '/' + formattedContent
  
  el_result.value = resultURL
}

el_dns_toggle.addEventListener('change', () => updateURL())
el_tun_toggle.addEventListener('change', () => updateURL())

editorView = createEditor({
  hint: 'http/s 订阅链接、除 http/s 代理的 uri、用 base64/base64url 编码的订阅内容或 Data URL，一行一个。' +
    '获取零节点订阅用 empty，可用于去广告',
  parent: el_editor,
  onUpdate(update) {
    if (!update.docChanged) return
    clearTimeout(timeout_id_update)
    timeout_id_update = setTimeout(() => updateURL(update.view), 100)
  },
})

const el_rules = document.querySelector('#rules-editor')
if (el_rules) {
  rulesEditorView = createEditor({
    hint: '远程规则链接 (MRS/YAML)，每行一个。自动绑定到“起飞”分组。',
    parent: el_rules,
    initialContent: initialRules,
    onUpdate(update) {
      if (!update.docChanged) return
      clearTimeout(timeout_id_update)
      timeout_id_update = setTimeout(() => updateURL(update.view), 100)
    },
  })
}

// Initial update to handle initialContent/initialRules
setTimeout(() => updateURL(), 200)

editorView.focus()

let timeout_id_remove_success_and_error

function removeSuccessAndError() {
  el_copy.classList.remove('success')
  el_copy.classList.remove('error')
}

el_copy.addEventListener('click', async () => {
  el_copy.classList.add('pending')
  removeSuccessAndError()
  clearTimeout(timeout_id_remove_success_and_error)
  try {
    await navigator.clipboard.writeText(el_result.value)
    el_copy.classList.add('success')
  } catch (e) {
    console.error(e.message)
    el_copy.classList.add('error')
  } finally {
    el_copy.classList.remove('pending')
    clearTimeout(timeout_id_remove_success_and_error)
    timeout_id_remove_success_and_error = setTimeout(removeSuccessAndError, 1000)
  }
})

function getName() {
  if (!editorView) return ''
  const input = editorView.state.doc.toString()
  let m
  if ((m = input.match(/^\s*https?:\/\/raw\.githubusercontent\.com\/+([^/\n]+)(?:\/+[^/\n]+){2,}\/+([^/\n]+)\s*$/))) {
    return m[1] === m[2] ? m[1] : m[1] + ' - ' + decodeURIComponent(m[2])
  } else if (
    (m = input.match(
      /^\s*(https?:\/\/raw\.githubusercontent\.com\/+([^/\n]+))(?:\/+[^/\n]+){3,}(?:\s*\n\s*\1(?:\/+[^/\n]+){3,})*\s*$/,
    ))
  ) {
    return m[2]
  } else if (
    (m = input.match(/^\s*(https?:\/\/gist\.githubusercontent\.com\/+([^/\n]+))\/[^\n]+(?:\s*\n\s*\1\/[^\n]+)*\s*$/))
  ) {
    return m[2] + ' - gist'
  }
  return ''
}

el_clash.addEventListener('click', () => {
  const url = new URL('clash://install-config')
  url.searchParams.set('url', el_result.value)
  const name = getName()
  if (name) url.searchParams.set('name', name)
  open(url, '_self')
})

el_editor.addEventListener('scroll', () => {
  if (el_editor.scrollTop === 0) {
    document.body.classList.remove('scrolled')
  } else {
    document.body.classList.add('scrolled')
  }
})
