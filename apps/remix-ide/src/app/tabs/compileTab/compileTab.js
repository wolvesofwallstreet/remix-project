const EventEmitter = require('events');
var Compiler = require('@remix-project/remix-solidity').Compiler;

class CompileTab {
  constructor(
    queryParams,
    fileManager,
    editor,
    config,
    fileProvider,
    contentImport
  ) {
    this.event = new EventEmitter();
    this.queryParams = queryParams;
    this.compilerImport = contentImport;
    this.compiler = new Compiler((url, cb) =>
      this.compilerImport
        .resolveAndSave(url)
        .then(result => cb(null, result))
        .catch(error => cb(error.message))
    );
    this.fileManager = fileManager;
    this.editor = editor;
    this.config = config;
    this.fileProvider = fileProvider;
  }

  init() {
    this.optimize = this.queryParams.get().optimize;
    this.optimize = this.optimize === 'true';
    this.queryParams.update({ optimize: this.optimize });
    this.compiler.set('optimize', this.optimize);

    this.runs = this.queryParams.get().runs;
    this.runs = this.runs || 200;
    this.queryParams.update({ runs: this.runs });
    this.compiler.set('runs', this.runs);

    this.evmVersion = this.queryParams.get().evmVersion;
    if (
      this.evmVersion === 'undefined' ||
      this.evmVersion === 'null' ||
      !this.evmVersion
    ) {
      this.evmVersion = null;
    }
    this.queryParams.update({ evmVersion: this.evmVersion });
    this.compiler.set('evmVersion', this.evmVersion);
  }

  setOptimize(newOptimizeValue) {
    this.optimize = newOptimizeValue;
    this.queryParams.update({ optimize: this.optimize });
    this.compiler.set('optimize', this.optimize);
  }

  setRuns(runs) {
    this.runs = runs;
    this.queryParams.update({ runs: this.runs });
    this.compiler.set('runs', this.runs);
  }

  setEvmVersion(newEvmVersion) {
    this.evmVersion = newEvmVersion;
    this.queryParams.update({ evmVersion: this.evmVersion });
    this.compiler.set('evmVersion', this.evmVersion);
  }

  /**
   * Set the compiler to using Solidity or Yul (default to Solidity)
   * @params lang {'Solidity' | 'Yul'} ...
   */
  setLanguage(lang) {
    this.compiler.set('language', lang);
  }

  getEVMData(target, content) {
    const parsed = JSON.parse(content);
    return {
      contracts: {
        [target]: {
          [parsed.contractName || 'CONTRACT']: {
            abi: parsed.abi,
            evm: parsed.data
              ? {
                  bytecode: parsed.data.bytecode,
                  deployedBytecode: parsed.data.deployedBytecode
                }
              : {
                  bytecode: { object: parsed.bytecode },
                  deployedBytecode: { object: parsed.deployedBytecode }
                }
          }
        }
      }
    };
  }

  /**
   * Compile a specific file of the file manager
   * @param {string} target the path to the file to compile
   */
  compileFile(target, analyse) {
    if (!target) throw new Error('No target provided for compiliation');
    const provider = this.fileManager.fileProviderOf(target);
    if (!provider)
      throw new Error(
        `cannot compile ${target}. Does not belong to any explorer`
      );
    return new Promise((resolve, reject) => {
      provider.get(target, (error, content) => {
        if (error) return reject(error);
        const sources = { [target]: { content } };
        this.event.emit('startingCompilation');
        if (analyse) {
          this.compiler.state.target = target;
          this.compiler.onCompilationFinished(
            this.getEVMData(target, content),
            [],
            { target: target, sources: sources }
          );
        }
        // setTimeout fix the animation on chrome... (animation triggered by 'staringCompilation')
        else
          setTimeout(() => {
            this.compiler.compile(sources, target);
            resolve();
          }, 100);
      });
    });
  }

  runCompiler(analyse) {
    try {
      this.fileManager.saveCurrentFile();
      this.editor.clearAnnotations();
      var currentFile = this.config.get('currentFile');
      return this.compileFile(currentFile, analyse);
    } catch (err) {
      console.error(err);
    }
  }
}

module.exports = CompileTab;
