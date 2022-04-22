/* oak build --web */
// module system
const __Oak_Modules = {};
let __Oak_Import_Aliases;
function __oak_modularize(name, fn) {
	__Oak_Modules[name] = fn;
}
function __oak_module_import(name) {
	if (typeof __Oak_Modules[name] === 'object') return __Oak_Modules[name];
	const module = __Oak_Modules[name] || __Oak_Modules[__Oak_Import_Aliases[name]];
	if (module) {
		__Oak_Modules[name] = {}; // break circular imports
		return __Oak_Modules[name] = module();
	} else {
		throw new Error(`Could not import Oak module "${name}" at runtime`);
	}
}

// language primitives
let __oak_empty_assgn_tgt;
function __oak_eq(a, b) {
	if (a === __Oak_Empty || b === __Oak_Empty) return true;

	// match either null or undefined to compare correctly against undefined ?s
	// appearing in places like optional arguments
	if (a == null && b == null) return true;
	if (a == null || b == null) return false;

	// match all other types that can be compared cheaply (without function
	// calls for type coercion or recursive descent)
	if (typeof a === 'boolean' || typeof a === 'number' ||
		typeof a === 'symbol' || typeof a === 'function') {
		return a === b;
	}

	// string equality check
	a = __as_oak_string(a);
	b = __as_oak_string(b);
	if (typeof a !== typeof b) return false;
	if (__is_oak_string(a) && __is_oak_string(b)) {
		return a.valueOf() === b.valueOf();
	}

	// deep equality check for composite values
	if (len(a) !== len(b)) return false;
	for (const key of keys(a)) {
		if (!__oak_eq(a[key], b[key])) return false;
	}
	return true;
}
function __oak_acc(tgt, prop) {
	return (__is_oak_string(tgt) ? __as_oak_string(tgt.valueOf()[prop]) : tgt[prop]) ?? null;
}
function __oak_obj_key(x) {
	return typeof x === 'symbol' ? Symbol.keyFor(x) : x;
}
function __oak_push(a, b) {
	a = __as_oak_string(a);
	a.push(b);
	return a;
}
function __oak_and(a, b) {
	if (typeof a === 'boolean' && typeof b === 'boolean') {
		return a && b;
	}
	if (__is_oak_string(a) && __is_oak_string(b)) {
		const max = Math.max(a.length, b.length);
		const get = (s, i) => s.valueOf().charCodeAt(i) || 0;

		let res = '';
		for (let i = 0; i < max; i ++) {
			res += String.fromCharCode(get(a, i) & get(b, i));
		}
		return res;
	}
	return a & b;
}
function __oak_or(a, b) {
	if (typeof a === 'boolean' && typeof b === 'boolean') {
		return a || b;
	}
	if (__is_oak_string(a) && __is_oak_string(b)) {
		const max = Math.max(a.length, b.length);
		const get = (s, i) => s.valueOf().charCodeAt(i) || 0;

		let res = '';
		for (let i = 0; i < max; i ++) {
			res += String.fromCharCode(get(a, i) | get(b, i));
		}
		return res;
	}
	return a | b;
}
function __oak_xor(a, b) {
	if (typeof a === 'boolean' && typeof b === 'boolean') {
		return (a && !b) || (!a && b);
	}
	if (__is_oak_string(a) && __is_oak_string(b)) {
		const max = Math.max(a.length, b.length);
		const get = (s, i) => s.valueOf().charCodeAt(i) || 0;

		let res = '';
		for (let i = 0; i < max; i ++) {
			res += String.fromCharCode(get(a, i) ^ get(b, i));
		}
		return res;
	}
	return a ^ b;
}
const __Oak_Empty = Symbol('__Oak_Empty');

// mutable string type
function __is_oak_string(x) {
	if (x == null) return false;
	return x.__mark_oak_string;
}
function __as_oak_string(x) {
	if (typeof x === 'string') return __Oak_String(x);
	return x;
}
const __Oak_String = s => {
	return {
		__mark_oak_string: true,
		assign(i, slice) {
			if (i === s.length) return s += slice;
			return s = s.substr(0, i) + slice + s.substr(i + slice.length);
		},
		push(slice) {
			s += slice;
		},
		toString() {
			return s;
		},
		valueOf() {
			return s;
		},
		get length() {
			return s.length;
		},
	}
}

// tail recursion trampoline helpers
function __oak_resolve_trampoline(fn, ...args) {
	let rv = fn(...args);
	while (rv && rv.__is_oak_trampoline) {
		rv = rv.fn(...rv.args);
	}
	return rv;
}
function __oak_trampoline(fn, ...args) {
	return {
		__is_oak_trampoline: true,
		fn: fn,
		args: args,
	}
}

// env (builtin) functions

// reflection and types
const __Is_Oak_Node = typeof process === 'object';
const __Oak_Int_RE = /^[+-]?\d+$/;
function int(x) {
	x = __as_oak_string(x);
	if (typeof x === 'number') {
		// JS rounds towards higher magnitude, Oak rounds towards higher value
		const rounded = Math.floor(x);
		const diff = x - rounded;
		if (x < 0 && diff === 0.5) return rounded + 1;
		return rounded;
	}
	if (__is_oak_string(x) && __Oak_Int_RE.test(x.valueOf())) {
		const i = Number(x.valueOf());
		if (isNaN(i)) return null;
		return i;
	}
	return null;
}
function float(x) {
	x = __as_oak_string(x);
	if (typeof x === 'number') return x;
	if (__is_oak_string(x)) {
		const f = parseFloat(x.valueOf());
		if (isNaN(f)) return null;
		return f;
	}
	return null;
}
function atom(x) {
	x = __as_oak_string(x);
	if (typeof x === 'symbol' && x !== __Oak_Empty) return x;
	if (__is_oak_string(x)) return Symbol.for(x.valueOf());
	return Symbol.for(string(x));
}
function string(x) {
	x = __as_oak_string(x);
	function display(x) {
		x = __as_oak_string(x);
		if (__is_oak_string(x)) {
			return '\'' + x.valueOf().replace('\\', '\\\\').replace('\'', '\\\'') + '\'';
		} else if (typeof x === 'symbol') {
			if (x === __Oak_Empty) return '_';
			return ':' + Symbol.keyFor(x);
		}
		return string(x);
	}
	if (x == null) {
		return '?';
	} else if (typeof x === 'number') {
		return x.toString();
	} else if (__is_oak_string(x)) {
		return x;
	} else if (typeof x === 'boolean') {
		return x.toString();
	} else if (typeof x === 'function') {
		return x.toString();
	} else if (typeof x === 'symbol') {
		if (x === __Oak_Empty) return '_';
		return Symbol.keyFor(x);
	} else if (Array.isArray(x)) {
		return '[' + x.map(display).join(', ') + ']';
	} else if (typeof x === 'object') {
		const entries = [];
		for (const key of keys(x).sort()) {
			entries.push(`${key}: ${display(x[key])}`);
		}
		return '{' + entries.join(', ') + '}';
	}
	throw new Error('string() called on unknown type ' + x.toString());
}
function codepoint(c) {
	c = __as_oak_string(c);
	return c.valueOf().charCodeAt(0);
}
function char(n) {
	return String.fromCharCode(n);
}
function type(x) {
	x = __as_oak_string(x);
	if (x == null) {
		return Symbol.for('null');
	} else if (typeof x === 'number') {
		// Many discrete APIs check for :int, so we consider all integer
		// numbers :int and fall back to :float. This is not an airtight
		// solution, but works well enough and the alternative (tagged number
		// values/types) have poor perf tradeoffs.
		if (Number.isInteger(x)) return Symbol.for('int');
		return Symbol.for('float');
	} else if (__is_oak_string(x)) {
		return Symbol.for('string');
	} else if (typeof x === 'boolean') {
		return Symbol.for('bool');
	} else if (typeof x === 'symbol') {
		if (x === __Oak_Empty) return Symbol.for('empty');
		return Symbol.for('atom');
	} else if (typeof x === 'function') {
		return Symbol.for('function');
	} else if (Array.isArray(x)) {
		return Symbol.for('list');
	} else if (typeof x === 'object') {
		return Symbol.for('object');
	}
	throw new Error('type() called on unknown type ' + x.toString());
}
function len(x) {
	if (typeof x === 'string' || __is_oak_string(x) || Array.isArray(x)) {
		return x.length;
	} else if (typeof x === 'object' && x !== null) {
		return Object.getOwnPropertyNames(x).length;
	}
	throw new Error('len() takes a string or composite value, but got ' + string(x));
}
function keys(x) {
	if (Array.isArray(x)) {
		const k = [];
		for (let i = 0; i < x.length; i ++) k.push(i);
		return k;
	} else if (typeof x === 'object' && x !== null) {
		return Object.getOwnPropertyNames(x).map(__as_oak_string);
	}
	throw new Error('keys() takes a composite value, but got ' + string(x).valueOf());
}

// OS interfaces
function args() {
	if (__Is_Oak_Node) return process.argv.map(__as_oak_string);
	return [window.location.href];
}
function env() {
	if (__Is_Oak_Node) {
		const e = Object.assign({}, process.env);
		for (const key in e) {
			e[key] = __as_oak_string(e[key]);
		}
		return e;
	}
	return {};
}
function time() {
	return Date.now() / 1000;
}
function nanotime() {
	return int(Date.now() * 1000000);
}
function rand() {
	return Math.random();
}
let randomBytes;
function srand(length) {
	if (__Is_Oak_Node) {
		// lazily import dependency
		if (!randomBytes) randomBytes = require('crypto').randomBytes;
		return randomBytes(length).toString('latin1');
	}

	const bytes = crypto.getRandomValues(new Uint8Array(length));
	return __as_oak_string(Array.from(bytes).map(b => String.fromCharCode(b)).join(''));
}
function wait(duration, cb) {
	setTimeout(cb, duration * 1000);
	return null;
}
function exit(code) {
	if (__Is_Oak_Node) process.exit(code);
	return null;
}
function exec() {
	throw new Error('exec() not implemented');
}

// I/O
function input() {
	throw new Error('input() not implemented');
}
function print(s) {
	s = __as_oak_string(s);
	if (__Is_Oak_Node) {
		process.stdout.write(string(s).toString());
	} else {
		console.log(string(s).toString());
	}
	return s.length;
}
function ls() {
	throw new Error('ls() not implemented');
}
function rm() {
	throw new Error('rm() not implemented');
}
function mkdir() {
	throw new Error('mkdir() not implemented');
}
function stat() {
	throw new Error('stat() not implemented');
}
function open() {
	throw new Error('open() not implemented');
}
function close() {
	throw new Error('close() not implemented');
}
function read() {
	throw new Error('read() not implemented');
}
function write() {
	throw new Error('write() not implemented');
}
function listen() {
	throw new Error('listen() not implemented');
}
function req() {
	throw new Error('req() not implemented');
}

// math
function sin(n) {
	return Math.sin(n);
}
function cos(n) {
	return Math.cos(n);
}
function tan(n) {
	return Math.tan(n);
}
function asin(n) {
	return Math.asin(n);
}
function acos(n) {
	return Math.acos(n);
}
function atan(n) {
	return Math.atan(n);
}
function pow(b, n) {
	return Math.pow(b, n);
}
function log(b, n) {
	return Math.log(n) / Math.log(b);
}

// runtime
function ___runtime_lib() {
	throw new Error('___runtime_lib() not implemented');
}
function ___runtime_lib__oak_qm() {
	throw new Error('___runtime_lib?() not implemented');
}
function ___runtime_gc() {
	throw new Error('___runtime_gc() not implemented');
}
function ___runtime_mem() {
	throw new Error('___runtime_mem() not implemented');
}
function ___runtime_proc() {
	throw new Error('___runtime_proc() not implemented');
}

// JavaScript interop
function call(target, fn, ...args) {
	return target[Symbol.keyFor(fn)](...args);
}
function __oak_js_new(Constructor, ...args) {
	return new Constructor(...args);
}
function __oak_js_try(fn) {
	try {
		return {
			type: Symbol.for('ok'),
			ok: fn(),
		}
	} catch (e) {
		return {
			type: Symbol.for('error'),
			error: e,
		}
	}
}
(__oak_modularize(__Oak_String(`lib/torus.js.oak`),function _(){return ((Renderer,__oak_js_default,h,map)=>(({__oak_js_default,map}=__oak_module_import(__Oak_String(`std`))),h=function h(tag=null,...args){return ((attrs,children,classes,events)=>(((__oak_cond)=>__oak_eq(__oak_cond,0)?null:__oak_eq(__oak_cond,1)?([children=null]=args):__oak_eq(__oak_cond,2)?([classes=null,children=null]=args):__oak_eq(__oak_cond,3)?([classes=null,attrs=null,children=null]=args):([classes=null,attrs=null,events=null,children=null]=args))(len(args)),(classes=__oak_js_default(classes,[])),(attrs=__oak_js_default(attrs,({}))),(events=__oak_js_default(events,({}))),(children=__oak_js_default(children,[])),({tag:String(string(tag)),attrs:((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(__Oak_String(`class`),__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt[__Oak_String(`class`)]):(__oak_assgn_tgt[__Oak_String(`class`)])=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(attrs),map(classes,String)),events,children:map(children,function _(child=null){return ((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('string'))?String(child):child)(type(child))})})))()},Renderer=function Renderer(root=null){return ((initialDOM,node,render,self,update)=>(((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('string'))?(root=(document.querySelector)(root)):null)(type(root)),(render=((window.Torus??null).render??null)),(initialDOM=h(Symbol.for('div'))),(node=render(null,null,initialDOM)),(root.appendChild)(node),(self=({node,prev:initialDOM,update:update=function update(jdom=null){return (((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(node,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.node):(__oak_assgn_tgt.node)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(self),render((self.node??null),(self.prev??null),jdom)),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(prev,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.prev):(__oak_assgn_tgt.prev)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(self),jdom),(self.node??null))}}))))()},({Renderer,__oak_js_default,h,map})))()}),__oak_modularize(__Oak_String(`src/app.js.oak`),function _(){return ((CachedSyntaxHighlightedEl,CachedSyntaxHighlightedKey,DefaultName,Link,Renderer,SiteName,State,__oak_js_default,enableWriteYourOwn,fetchText,fmt,generateModel,h,json,linkifyCurrent,map,merge,modelMeta,modelName,pathname,println,r,random,render,sig,split,syntaxHighlight,trim,unsig)=>(({println,__oak_js_default,map,merge}=__oak_module_import(__Oak_String(`std`))),({trim,split}=__oak_module_import(__Oak_String(`str`))),(fmt=__oak_module_import(__Oak_String(`fmt`))),(json=__oak_module_import(__Oak_String(`json`))),(random=__oak_module_import(__Oak_String(`random`))),({Renderer,h}=__oak_module_import(__Oak_String(`lib/torus.js.oak`))),(SiteName=__Oak_String(`This AI Does Not Exist`)),(DefaultName=(PregeneratedModel.name??null)),(State=({loading__oak_qm:false,name:DefaultName,defn:(PregeneratedModel.defn??null),usage:(PregeneratedModel.usage??null),permalinkCopied:false})),sig=function sig(o=null){return (btoa(encodeURIComponent((json.serialize)(o))))},unsig=function unsig(s=null){return ((json.parse)(decodeURIComponent(atob(s))))},fetchText=function fetchText(url=null,body=null,withRespText=null){return ((handleError)=>(handleError=function handleError(err=null){return (println(String(err)),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(loading__oak_qm,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.loading__oak_qm):(__oak_assgn_tgt.loading__oak_qm)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(State),false),render())},(fetch(url,({method:__Oak_String(`POST`),body})).then)(function _(resp=null){return ((__oak_cond)=>__oak_eq(__oak_cond,200)?((resp.text)().then)(withRespText):((resp.text)().then)(function _(respText=null){return (handleError(__oak_js_new(Error,respText)))}))((resp.status??null))},handleError)))()},generateModel=function generateModel(){return ((name)=>((name=trim((State.name??null))),((__oak_cond)=>__oak_eq(__oak_cond,true)?(((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(loading__oak_qm,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.loading__oak_qm):(__oak_assgn_tgt.loading__oak_qm)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(State),true),render(),fetchText(__Oak_String(`/generate/model`),name,function _(defn=null){return (((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(defn,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.defn):(__oak_assgn_tgt.defn)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(State),defn),render(),fetchText(__Oak_String(`/generate/usage`),defn,function _(usage=null){return (((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(loading__oak_qm,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.loading__oak_qm):(__oak_assgn_tgt.loading__oak_qm)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(State),false),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(usage,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.usage):(__oak_assgn_tgt.usage)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(State),usage),render(),(history.replaceState)(null,null,linkifyCurrent()),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(title,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.title):(__oak_assgn_tgt.title)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(document),(fmt.format)(__Oak_String(`{{0}} | {{1}}`),name,SiteName)))}))})):null)((__oak_left=>__oak_left===false?false:__oak_and(__oak_left,!(State.loading__oak_qm??null)))(!__oak_eq(name,__Oak_String(``))))))()},linkifyCurrent=function linkifyCurrent(){return ((url)=>((url=__oak_js_new(URL,(location.href??null))),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(pathname,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.pathname):(__oak_assgn_tgt.pathname)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(url),(fmt.format)(__Oak_String(`/model/{{0}}/{{1}}`),(State.name??null),sig(({defn:(State.defn??null),usage:(State.usage??null)})))),String(url)))()},enableWriteYourOwn=function enableWriteYourOwn(){return ((((document.body??null).classList??null).add)(__Oak_String(`write-your-own`)))},(CachedSyntaxHighlightedKey=__Oak_String(``)),(CachedSyntaxHighlightedEl=(document.createElement)(__Oak_String(`span`))),syntaxHighlight=function syntaxHighlight(code=null){return ((__oak_cond)=>__oak_eq(__oak_cond,CachedSyntaxHighlightedKey)?CachedSyntaxHighlightedEl:((CachedSyntaxHighlightedKey=code),(CachedSyntaxHighlightedEl=(document.createElement)(__Oak_String(`span`))),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(innerHTML,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.innerHTML):(__oak_assgn_tgt.innerHTML)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(CachedSyntaxHighlightedEl),((hljs.highlight)(String(code),({language:String(__Oak_String(`python`))})).value??null))))(code)},(r=Renderer(__Oak_String(`#root`))),Link=function Link(text=null,href=null){return h(Symbol.for('a'),[],({href,target:__Oak_String(`_blank`)}),[text])},render=function render(){return ((r.update)(h(Symbol.for('div'),[__Oak_String(`app`)],[h(Symbol.for('header'),[],[h(Symbol.for('a'),[__Oak_String(`logo`)],({href:__Oak_String(`/`)}),[SiteName]),Link(__Oak_String(`about`),__Oak_String(`https://github.com/thesephist/modelexicon`))]),h(Symbol.for('main'),[],[h(Symbol.for('div'),[__Oak_String(`model-name`)],[h(Symbol.for('input'),[__Oak_String(`model-name-input`)],({value:(State.name??null),placeholder:DefaultName}),({input:function _(evt=null){return (enableWriteYourOwn(),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(name,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.name):(__oak_assgn_tgt.name)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(State),((evt.target??null).value??null)),render())},keydown:function _(evt=null){return ((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(`Enter`))?((evt.preventDefault)(),generateModel()):null)((evt.key??null))}}),[]),((__oak_cond)=>__oak_eq(__oak_cond,true)?(h(Symbol.for('button'),[__Oak_String(`model-name-submit`)],({title:__Oak_String(`Generate this model`),disabled:(State.loading__oak_qm??null)}),({click:function _(){return (generateModel())}}),[__Oak_String(`Go!`)])):null)(!__oak_eq(trim((State.name??null)),__Oak_String(``)))]),h(Symbol.for('div'),[__Oak_String(`controls`)],[h(Symbol.for('button'),[],({title:__Oak_String(`Generate another AI`)}),({click:function _(){return (((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(href,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.href):(__oak_assgn_tgt.href)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string((window.location??null)),__Oak_String(`/`)))}}),[__Oak_String(`Next`)]),__Oak_String(` · `),h(Symbol.for('button'),[],({title:__Oak_String(`Enter your own AI name`)}),({click:function _(){return ((nameInput)=>((nameInput=(document.querySelector)(__Oak_String(`input.model-name-input`))),(nameInput.focus)(),(nameInput.setSelectionRange)(0,len((nameInput.value??null)))))()}}),[__Oak_String(`Try your own`)]),__Oak_String(` · `),h(Symbol.for('button'),[],({title:__Oak_String(`Copy a link to this AI`)}),({click:function _(){return ((((navigator.clipboard??null).writeText)(linkifyCurrent()).then)(function _(){return (((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(permalinkCopied,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.permalinkCopied):(__oak_assgn_tgt.permalinkCopied)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(State),true),render(),wait(1.5,function _(){return (((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(permalinkCopied,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.permalinkCopied):(__oak_assgn_tgt.permalinkCopied)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(State),false),render())}))}))}}),[((__oak_cond)=>__oak_eq(__oak_cond,true)?__Oak_String(`Copied!`):__Oak_String(`Copy link`))((State.permalinkCopied??null))])]),h(Symbol.for('div'),[__Oak_String(`model-defn`)],[((__oak_cond)=>__oak_eq(__oak_cond,null)?__Oak_String(`Generating description ...`):(State.defn??null))((State.defn??null))]),h(Symbol.for('div'),[__Oak_String(`model-usage`)],[h(Symbol.for('h2'),[],[__Oak_String(`Usage`)]),h(Symbol.for('pre'),[__Oak_String(`model-usage-pre`)],[h(Symbol.for('code'),[__Oak_String(`model-usage-code`)],[((__oak_cond)=>__oak_eq(__oak_cond,null)?syntaxHighlight(__Oak_String(`# generating usage ...`)):syntaxHighlight((State.usage??null)))((State.usage??null))])])])]),h(Symbol.for('footer'),[],[Link(SiteName,__Oak_String(`https://github.com/thesephist/modelexicon`)),__Oak_String(` is a project by `),Link(__Oak_String(`Linus`),__Oak_String(`https://thesephist.com`)),__Oak_String(` built with `),Link(__Oak_String(`Oak`),__Oak_String(`https://oaklang.org`)),__Oak_String(` and `),Link(__Oak_String(`Torus`),__Oak_String(`https://github.com/thesephist/torus`)),__Oak_String(`.`)])])))},(pathname=(__oak_js_new(URL,(location.href??null)).pathname??null)),([__oak_empty_assgn_tgt=null,__oak_empty_assgn_tgt=null,modelName=null,modelMeta=null]=split(pathname,__Oak_String(`/`))),((__oak_cond)=>__oak_eq(__oak_cond,true)?((DefaultName=decodeURIComponent(modelName)),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(name,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.name):(__oak_assgn_tgt.name)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(State),DefaultName),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(title,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.title):(__oak_assgn_tgt.title)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(document),(fmt.format)(__Oak_String(`{{0}} | {{1}}`),(State.name??null),SiteName)),merge(State,unsig(decodeURIComponent(modelMeta)))):((history.replaceState)(null,null,linkifyCurrent()),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(title,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.title):(__oak_assgn_tgt.title)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(document),(fmt.format)(__Oak_String(`{{0}} | {{1}}`),(State.name??null),SiteName))))((__oak_left=>__oak_left===false?false:__oak_and(__oak_left,!__oak_eq(modelMeta,null)))(!__oak_eq(modelName,null))),render(),((__oak_cond)=>__oak_eq(__oak_cond,true)?generateModel():null)(__oak_eq((State.defn??null),null)),({CachedSyntaxHighlightedEl,CachedSyntaxHighlightedKey,DefaultName,Link,Renderer,SiteName,State,__oak_js_default,enableWriteYourOwn,fetchText,fmt,generateModel,h,json,linkifyCurrent,map,merge,modelMeta,modelName,pathname,println,r,random,render,sig,split,syntaxHighlight,trim,unsig})))()}),__oak_modularize(__Oak_String(`fmt`),function _(){return ((__oak_js_default,format,printf,println)=>(({println,__oak_js_default}=__oak_module_import(__Oak_String(`std`))),format=function format(raw=null,...values){return ((buf,key,sub,value,which)=>((which=0),(key=__Oak_String(``)),(buf=__Oak_String(``)),(value=__oak_js_default(__oak_acc(values,0),({}))),sub=function sub(idx=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(idx=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?((c)=>((c=__oak_acc(raw,__oak_obj_key((idx)))),((__oak_cond)=>__oak_eq(__oak_cond,0)?((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(`{`))?(which=1):__oak_push(buf,c))(c):__oak_eq(__oak_cond,1)?((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(`{`))?(which=2):(__oak_push(__oak_push(buf,__Oak_String(`{`)),c),(which=0)))(c):__oak_eq(__oak_cond,2)?((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(`}`))?((index)=>((index=int(key)),__oak_push(buf,string(((__oak_cond)=>__oak_eq(__oak_cond,__oak_eq(key,__Oak_String(``)))?__Oak_String(``):__oak_eq(__oak_cond,__oak_eq(index,null))?__oak_acc(value,__oak_obj_key((key))):__oak_acc(values,__oak_obj_key((index))))(true))),(key=__Oak_String(``)),(which=3)))():__oak_eq(__oak_cond,__Oak_String(` `))?null:__oak_eq(__oak_cond,__Oak_String(`	`))?null:(key=__as_oak_string(key+c)))(c):__oak_eq(__oak_cond,3)?((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(`}`))?(which=0):null)(c):null)(which),__oak_trampoline(__oak_trampolined_sub,__as_oak_string(idx+1))))():buf)((idx<len(raw)))}),__oak_resolve_trampoline(__oak_trampolined_sub,idx)))()},sub(0)))()},printf=function printf(raw=null,...values){return println(format(raw,...values))},({__oak_js_default,format,printf,println})))()}),__oak_modularize(__Oak_String(`json`),function _(){return ((Reader,_parseReader,__oak_js_default,esc,escape,join,map,parse,parseFalse,parseList,parseNull,parseNumber,parseObject,parseString,parseTrue,serialize,slice,space__oak_qm)=>(({__oak_js_default,slice,map}=__oak_module_import(__Oak_String(`std`))),({space__oak_qm,join}=__oak_module_import(__Oak_String(`str`))),esc=function esc(c=null){return ((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(`	`))?__Oak_String(`\\t`):__oak_eq(__oak_cond,__Oak_String(`
`))?__Oak_String(`\\n`):__oak_eq(__oak_cond,__Oak_String(`
`):__oak_eq(__oak_cond,__Oak_String(`r`))?__Oak_String(`
`)))((evt.type??null))))()})))()},println=function println(...xs){return ((__oak_cond)=>__oak_eq(__oak_cond,0)?print(__Oak_String(`
`)):((out)=>((out=reduce(slice(xs,1),string(__oak_acc(xs,0)),function _(acc=null,x=null){return (__as_oak_string(__as_oak_string(acc+__Oak_String(` `))+string(x)))})),print(__as_oak_string(out+__Oak_String(`
`)))))())(len(xs))},({_asPredicate,_baseIterator,_hToN,_nToH,append,clamp,clone,compact,contains__oak_qm,debounce,__oak_js_default,each,entries,every,filter,find,first,flatten,fromHex,identity,indexOf,join,last,loop,map,merge,once,partition,println,range,reduce,reverse,slice,some,stdin,take,takeLast,toHex,uniq,values,zip})))()}),__oak_modularize(__Oak_String(`str`),function _(){return ((_extend,_matchesAt__oak_qm,_replaceNonEmpty,_splitNonEmpty,_trimEndNonEmpty,_trimEndSpace,_trimStartNonEmpty,_trimStartSpace,checkRange,contains__oak_qm,cut,__oak_js_default,digit__oak_qm,endsWith__oak_qm,indexOf,join,letter__oak_qm,lower,lower__oak_qm,padEnd,padStart,reduce,replace,slice,space__oak_qm,split,startsWith__oak_qm,take,takeLast,trim,trimEnd,trimStart,upper,upper__oak_qm,word__oak_qm)=>(({__oak_js_default,slice,take,takeLast,reduce}=__oak_module_import(__Oak_String(`std`))),checkRange=function checkRange(lo=null,hi=null){let checker;return checker=function checker(c=null){return ((p)=>((p=codepoint(c)),(__oak_left=>__oak_left===false?false:__oak_and(__oak_left,(p<=hi)))((lo<=p))))()}},upper__oak_qm=function upper__oak_qm(c=null){return (__oak_left=>__oak_left===false?false:__oak_and(__oak_left,(c<=__Oak_String(`Z`))))((c>=__Oak_String(`A`)))},lower__oak_qm=function lower__oak_qm(c=null){return (__oak_left=>__oak_left===false?false:__oak_and(__oak_left,(c<=__Oak_String(`z`))))((c>=__Oak_String(`a`)))},digit__oak_qm=function digit__oak_qm(c=null){return (__oak_left=>__oak_left===false?false:__oak_and(__oak_left,(c<=__Oak_String(`9`))))((c>=__Oak_String(`0`)))},space__oak_qm=function space__oak_qm(c=null){return ((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(` `))?true:__oak_eq(__oak_cond,__Oak_String(`	`))?true:__oak_eq(__oak_cond,__Oak_String(`
`))?true:__oak_eq(__oak_cond,__Oak_String(`