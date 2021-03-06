/**
 * @file Implementation require for XScript.
 * @author Vlad Kurkin, b-vladi@yandex-team.ru
 * @version 1.3
 * @license <a href="https://github.com/appendto/amplify/blob/master/MIT-LICENSE.txt">MIT</a>
 */

/**
 * Пространство имен XJS-модулей.
 * @name $XM
 * @namespace
 * @see require
 */
var $XM = {};

var require = (function () {
	//noinspection JSHint, JSUnresolvedVariable
	var
		$X = xscript,
		CACHE = {},
		parent = null;

	function requireFactory(module) {
		function Wrapper(namespace) {
			parent = module;
			return Require(namespace);
		}

		Wrapper.path = Require.path;
		Wrapper.extension = Require.extension;
		Wrapper.packageName = Require.packageName;
		Wrapper.prototype = Require.prototype;

		return Wrapper;
	}

	function Exports() {
	}

	/**
	 * Конструктор объекта модуля.
	 * @name Module
	 * @constructor
	 * @private
	 * @param {String} path Путь к файлу или дирректории.
	 * @param {String|null} namespace Пространство имен модуля.
	 * @startuml
	 * class Module {
		 *  +exports
		 *  +prototype
		 *  +source
		 *  +path
		 *  +basedir
		 *  --Load as namespace--
		 *  +namespace
		 *  ..Load from package.json..
		 *  +package
		 *  --Load as component--
		 *  +parent
		 *  --
		 *  #require(namespace)
		 *  #load(path)
		 *  #compile()
		 * }
	 * @enduml
	 */
	function Module(path, namespace) {
		/**
		 * Функция загрузки модуля, аналогична {@link require}.
		 * @name Module#require
		 * @method
		 */
		this.require = requireFactory(this);

		/**
		 * Реализация модуля, являющаяся его внешним API. По-умолчанию этот объект наследует от {@link Module#prototype}. Для того, что бы разорвать наследование между уровнями переопределения, достаточно заменить значение этого свойства (см. диаграмму с примером наследования в исходниках).
		 * @name Module#exports
		 * @type {Object}
		 */
		this.exports = new Exports();

		/**
		 * Ссылка на прототип объекта {@link Module#exports}. Концом цепочки наследования является {@link require}.prototype, если не было переопределено свойство {@link Module#exports} на каком-либо уровне переопределения.
		 * @name Module#prototype
		 * @type {Object}
		 * @example
		 * // Исходный код модуля, находящегося на втором уровне переопределения.
		 * // Перекрытие наследуемого метода.
		 * this.log = function (string) {
			 *   // Вызов исходного метода
			 *   return module.prototype.log('[LOG]: ' + string);
			 * }
		 */
		this.prototype = Exports.prototype;

		/**
		 * Ссылка на JSON-объект, загруженный из {@link require}.packageName.
		 * @name Module#package
		 * @default null
		 * @type {Object}
		 */
		this.package = null;

		/**
		 * Пространство имен модуля.
		 * @name Module#namespace
		 * @default null
		 * @type {String}
		 */
		this.namespace = namespace;

		/**
		 * Ссылка на родительский объект модуля. Существует, если текущий модуль был загружен как компонент родителя.
		 * @name Module#parent
		 * @default null
		 * @type {Module}
		 * @example
		 * // Загрузка компонента из модуля
		 * this.foo = 'bar';
		 * var component = require(basedir + 'component.js');
		 *
		 * // Доступ к API родителя из component.js
		 * module.parent.exports.foo // bar
		 */
		this.parent = typeof namespace === 'string' ? null : parent;

		parent = null;

		this.load(path);
		this.compile();
	}

	/**
	 * Загружает код модуля из папки dir. Поиск кода осуществляется последовательно в местах:
	 * <br /><br />
	 * Если путь указывает на дирректорию (заканчивается на "/"), то:
	 * <ol>
	 *   <li>Ищется файл, имя которого совпадает с пространством имен модуля и расширение соответствует {@link require}.extension.</li>
	 *   <li>Ищется дирректория, имя которой совпадает с пространством имен модуля. <br />Если папка найдена, в ней ищется файл package.json, в котором свойство JSON-объекта "main" указывает на входной файл модуля в текущей дирректории. Если свойство "main" не указано, в качестве имени входного файла будет использоваться значение пространства имен модуля с расширением {@link require}.extension.</li>
	 * </ol>
	 * Если путь указывает на файл, и пространство имен модуля не указано (обращение к компоненту модуля), код загружается по указанному пути.
	 * <br /><br />
	 * Таким образом, файловая структура модуля c установленным namespace может представлять собой:
	 * <ol>
	 *   <li>namespace.js</li>
	 *   <li>namespace/
	 *   <br />&nbsp;&nbsp;package.json ({"main": "main.js"})
	 *   <br />&nbsp;&nbsp;main.js
	 *   </li>
	 *   <li>namespace/
	 *   <br />&nbsp;&nbsp;namespace.js
	 *   </li>
	 * </ol>
	 *
	 * @param {String} dir Путь к файлу или дирректории.
	 * @return {String} Путь к загруженному коду модуля.
	 * @name Module#load
	 * @method
	 */
	Module.prototype.load = function (dir) {
		var
			PATH_TO_FILE = 1,
			PATH_TO_PACKAGE = 2,
			PATH_TO_DIR = 3;

		var
			namespace = this.namespace,
			state = PATH_TO_FILE,
			path;

		if (dir.substr(-1) === '/') {
			dir += namespace;
			path = dir + '.' + Require.extension;
		} else {
			path = dir;
		}

		dir += '/';

		while (true) {
			if (require.file.test(path)) {
				if (state === PATH_TO_PACKAGE) {
					try {
						this.package = JSON.parse(stripBOM(require.file.load(path)));
					} catch (error) {
						throw 'Can`t parse .json file: "' + path + '"';
					}

					path = dir + (this.package.hasOwnProperty('main') ? this.package.main : namespace + '.' + Require.extension);
					state = PATH_TO_DIR;
				} else {
					/**
					 * Исходный код модуля.
					 * @name Module#source
					 * @type {String}
					 */
					this.source = stripBOM(require.file.load(path));

					/**
					 * Путь к файлу модуля от docroot://.
					 * @name Module#path
					 * @type {String}
					 */
					this.path = path;

					/**
					 * Путь к папке, из которой был загружен модуль.
					 * @name Module#basedir
					 * @type {String}
					 */
					this.basedir = path.substring(0, path.lastIndexOf('/') + 1);

					return path;
				}
			} else if (state === PATH_TO_FILE && typeof namespace === 'string') {
				path = dir + Require.packageName;
				state = PATH_TO_PACKAGE;
			} else if (state === PATH_TO_PACKAGE) {
				path = dir + namespace + '.' + Require.extension;
				state = PATH_TO_DIR;
			} else {
				throw {
					name: 'RequireCantFindModuleInPath',
					message: 'Can`t find module: "' + path + '", paths: ' + Require.path
				};
			}
		}
	};

	/**
	 * Компилирует модуль. В глобальной области видимости модуля доступны следующие переменные:
	 * <pre>
	 * <b>module</b> - ссылка на объект модуля.
	 * <b>exports</b> - ссылка на объект {@link Module#exports}.
	 * <b>require</b> - ссылка на метод {@link Module#require}.
	 * <b>basedir</b> - значение свойства {@link Module#basedir}.
	 * </pre>
	 * Код модуля выполняется в контексте {@link Module#exports}.
	 * @return {Module}
	 * @name Module#compile
	 * @method
	 */
	Module.prototype.compile = function () {
		//noinspection JSHint
		new Function('module', 'exports', 'require', 'basedir', this.source)
			.call(this.exports, this, this.exports, this.require, this.basedir);

		return this;
	};

	function stripBOM(content) {
		if (content.charCodeAt(0) === 0xFEFF) {
			content = content.slice(1);
		}

		return content;
	}

	function createNamespace(module) {
		var
			name,
			index = 0,
			namespace = module.namespace.split('.'),
			length = namespace.length,
			currentNamespace = $XM;

		while (index < length) {
			name = namespace[index++];

			if (index === length) {
				currentNamespace[name] = module.exports;
			} else if (!currentNamespace.hasOwnProperty(name)) {
				currentNamespace[name] = {};
			}

			currentNamespace = currentNamespace[name];
		}
	}

	/**
	 * Implementation require for XScript. See {@tutorial README}.
	 * @tutorial README
	 * @param {String} namespace Пространство имен модуля или абсолютный путь к JS-файлу. В последнем случае require воспринимает это как обращение к компоненту модуля (см. диаграмму алгоритма работы в исходниках).
	 * @namespace require
	 * @function
	 * @return {Object} Внешнее API модуля. См {@link Module#exports}.
	 * @property {Array} path Массив путей с директориями, в которых будут искаться файлы модулей. Каждый путь представляет собой уровень переопределения, выстраивающий соответствующую цепочку наследования модулей из одного пространства имен.
	 * @property {String} [extension='js'] Расширение файлов модулей. См {@link Module#load}.
	 * @property {String} [packageName='package.json'] Имя JSON-файла, содержащий информацию о модуле. См {@link Module#load}.
	 * @property {object} [file=xscript.file] Объект с методами доступа к файловой системе.
	 * @property {Object} prototype Общий прототип объектов API модулей ({@link Module#exports}).
	 * @example
	 * // Загрузка модуля из разных уровней переопределения
	 * require.path = ['/path/to/first/dir/', 'path/to/second/dir'];
	 * require('names.space');
	 * // В этом случае объект API модуля, загруженного из файла "path/to/second/dir/names.space.js" будет наследовать от API модуля, загруженного из "/path/to/first/dir/names.space.js".
	 *
	 * // Доступ к модулям из пространства имен
	 * require('some.name.space');
	 * $XM.some.name.space; // объект {@link Module#exports}.
	 *
	 * @startuml
	 * title Алгоритм работы require()
	 * note top: require(namespace);
	 * (*) -d-> if "" then
	 *   note left: The module\nis in the cache??
	 *   --> [true] "Return module" as Return
	 * else
	 *   -r-> [false] if "" then
	 *     note top: Start with\n'docroot://'?
	 *     -r-> [true] "Component"
	 *   else
	 *     -r-> [false] "Iterating of paths"
	 *   endif
	 * endif

	 * "Save module in cache" as SaveInCache -l-> Return
	 * -d-> (*)

	 * partition "Modules" {
		 *   partition "Iterating of paths" {
		 *     "Resolve path" -r-> "Load Module"
		 *     -r-> "Compile" as Compile1
		 *   }

		 *   "Create namespace" --> SaveInCache
		 * }

	 * partition "Component" {
		 *   "Load file from\n<b>namespace</b>" -r-> "Set parent module"
		 *   -r-> "Compile" as Compile2
		 *   --> SaveInCache
		 * }
	 * @enduml

	 * @startuml
	 * title Пример наследования API модулей, загруженных из разных уровней переопределения.

	 * object Exports.prototype {
		 * }

	 * package "Level override 1" #DFDFDF-ffffff {
		 *   object "$XM.user.settings" as Settings_1 << (E,orchid) >> {
		 *     +someMethod1()
		 *     +someMethod2()
		 *   }

		 *   object "$XM.geo" as Geo_1 << (E,orchid) >> {
		 *     +someField1 = someValue
		 *   }
		 * }
	 *
	 * package "Level override 2" #DFDFDF-ffffff {
		 *   object "$XM.user.settings" as Settings_2 << (E,orchid) >> {
		 *     +someMethod3()
		 *   }
		 *
		 *   object "$XM.geo" as Geo_2 << (E,orchid) >> {
		 *     +someField2 = someValue
		 *   }
		 * }
	 *
	 * Exports.prototype <-- Settings_1
	 * Exports.prototype <-- Geo_1
	 *
	 * Settings_1 <-- Settings_2
	 * Geo_1 .. Geo_2
	 *
	 * note top of Geo_1
	 *   this.someField1 = someValue;
	 * end note
	 *
	 * note top of Settings_1
	 *   this.someMethod1 = function () {};
	 *   this.someMethod2 = function () {};
	 * end note
	 *
	 * note bottom of Geo_2
	 *   module.exports = {someField2: someValue};
	 * end note
	 *
	 * note bottom of Settings_2
	 *   this.someMethod3 = function () {};
	 *   module.exports.someMethod3 = function () {};
	 * end note
	 * @enduml
	 */
	function Require(namespace) {
		var
			module = null,
			index = 0,
			pathsLength = Require.path.length;

		if (typeof namespace !== 'string' || namespace === '') {
			throw 'First argument must be non-empty string.';
		}

		if (CACHE.hasOwnProperty(namespace)) {
			return CACHE[namespace];
		}

		if (namespace.indexOf('docroot://') === 0) {
			module = new Module(namespace, null);
		} else {
			while (index < pathsLength) {
				Exports.prototype = module ? module.exports : Require.prototype;

				try {
					module = new Module(Require.path[index++], namespace);
				} catch (e) {
					if (e.name !== 'RequireCantFindModuleInPath') {
						throw e;
					}
				}
			}

			if (module) {
				createNamespace(module);
			} else {
				throw 'Can`t find module: "' + namespace + '", paths: ' + Require.path;
			}
		}

		CACHE[namespace] = module.exports;

		return module.exports;
	}

	Require.path = [];
	Require.extension = 'js';
	Require.packageName = 'package.json';
	Require.file = $X.file;
	Require.prototype = Exports.prototype;

	return Require;
}());
