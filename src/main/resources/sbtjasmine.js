/*
 EnvJasmine: Jasmine test runner for EnvJS.

 EnvJasmine allows you to run headless JavaScript tests.

 Based on info from:
 http://agile.dzone.com/news/javascript-bdd-jasmine-without
 http://www.mozilla.org/rhino/
 http://www.envjs.com/
 http://pivotal.github.com/jasmine/
 https://github.com/velesin/jasmine-jquery
*/

importPackage(java.lang);
importPackage(java.io);
importPackage(org.mozilla.javascript);
importPackage(com.gu);

// Create the EnvJasmine namespace
if (!this.EnvJasmine) {
    this.EnvJasmine = {};
}

EnvJasmine.cx = Context.getCurrentContext();
EnvJasmine.cx.setOptimizationLevel(-1);
EnvJasmine.topLevelScope = this;

EnvJasmine.normalizePath = function(path) {
    var endsInSlash = (path.slice(-1) == "/");

    if (path.slice(0, 1) == ".") {
        path = EnvJasmine.rootDir + path;
    }

    return File(path).getCanonicalPath() + (endsInSlash ? "/" : "");
};

EnvJasmine.loadFactory = function(scope) {
    return function (path) {
        var fileIn,
            normalizedPath = EnvJasmine.normalizePath(path);

        try {
            fileIn = new FileReader(normalizedPath);
            EnvJasmine.cx.evaluateReader(scope, fileIn, normalizedPath, 0, null);
        } catch (e) {
            print('Could not read file: ' + normalizedPath + "\n error was: " + e );
        } finally {
            fileIn.close();
        }
    };
};

EnvJasmine.resourceLoadFactory = function(scope) {
    return function (path) {
        var reader;

        try {
            reader = new BundledLibraryReaderFactory(path).reader();
            EnvJasmine.cx.evaluateReader(scope, reader, path, 0, null);
        } catch (e) {
            print('Could not read resource: ' + path + "\n error was: " + e );
        } finally {
            reader.close();
        }
    };
};

EnvJasmine.loadGlobal = EnvJasmine.loadFactory(EnvJasmine.topLevelScope);
EnvJasmine.loadLibGlobal = EnvJasmine.resourceLoadFactory(EnvJasmine.topLevelScope);

EnvJasmine.environment = 'UNIX';

function setupDirs(appJsRoot, appJsLibRoot, testRoot, confFile) {

    EnvJasmine.testDir = EnvJasmine.normalizePath(testRoot + "/");
    EnvJasmine.mocksDir = EnvJasmine.normalizePath(EnvJasmine.testDir + "mocks/");
    EnvJasmine.specsDir = EnvJasmine.normalizePath(EnvJasmine.testDir + "specs/");
    EnvJasmine.rootDir = EnvJasmine.normalizePath(appJsRoot + "/");
    EnvJasmine.libDir = EnvJasmine.normalizePath(appJsLibRoot + "/");

    // This is the standard spec suffix
    EnvJasmine.specSuffix = new RegExp(/.spec.js$/);

    EnvJasmine.configFile = confFile;
};

EnvJasmine.disableColor = (function (env) {
    return EnvJasmine.disableColorOverride || (env == "WIN");
}(EnvJasmine.environment));

(function() {
    if (EnvJasmine.disableColor) {
        EnvJasmine.green = function(msg) { return msg; };
        EnvJasmine.red = function(msg) { return msg; };
        EnvJasmine.plain = function(msg) { return msg; };
    } else {
        var green = "\033[32m",
            red = "\033[31m",
            end = "\033[0m";

        EnvJasmine.green = function(msg) { return green + msg + end; };
        EnvJasmine.red = function(msg) { return red + msg + end; };
        EnvJasmine.plain = function(msg) { return msg; };
    }
}());

EnvJasmine.results = [];

EnvJasmine.loadConfig = function () {
    EnvJasmine.loadLibGlobal("jasmineEnv.js")
    EnvJasmine.loadGlobal(EnvJasmine.configFile);
};

function runTests(appJsRoot, appJsLibRoot, testRoot, confFile, envHtml) {
    var i, fileIn, len;

    setupDirs(appJsRoot, appJsLibRoot, testRoot, confFile);

    EnvJasmine.specs = [];
    EnvJasmine.passedCount = 0;
    EnvJasmine.failedCount = 0;
    EnvJasmine.totalCount = 0;

    EnvJasmine.loadConfig();
    
    if (typeof EnvJasmine.reporterClass === "undefined") {
    	// Use the standard reporter
    	EnvJasmine.reporterClass = RhinoReporter;
    }

    jasmine.getEnv().addReporter(new EnvJasmine.reporterClass());
    jasmine.getEnv().updateInterval = 0; // do not yield.

    if (EnvJasmine.suppressConsoleMsgs === true) {
        // suppress console messages
        window.console = $.extend({}, window.console, {
            info: jasmine.createSpy(),
            log: jasmine.createSpy(),
            debug: jasmine.createSpy(),
            warning: jasmine.createSpy(),
            error: jasmine.createSpy()
        });
    }

    EnvJasmine.loadLibGlobal("spanDir/spanDir.js");
    if (EnvJasmine.specs.length == 0) {
        spanDir(EnvJasmine.specsDir, function(spec) {
            if (EnvJasmine.specSuffix.test(spec)) {
                EnvJasmine.specs.push(spec);
            }
        });
    }

    for (i = 0, len = EnvJasmine.specs.length >>> 0; i < len; i += 1) {
        try {
            EnvJasmine.currentScope = {};
            EnvJasmine.load = EnvJasmine.loadFactory(EnvJasmine.currentScope);
            EnvJasmine.specFile = EnvJasmine.specs[i];
            print("running spec:" + EnvJasmine.specFile);
            // TODO: allow 'inline' loading when AMD disabled
            // fileIn = new FileReader(EnvJasmine.specFile);
            // EnvJasmine.cx.evaluateReader(EnvJasmine.currentScope, fileIn, EnvJasmine.specs[i], 0, null);
			var pathToSpecFile = EnvJasmine.specFile.toString().replaceAll("\\\\", "/");
            var specLoader = 'require(["' + pathToSpecFile + '"]);';
            EnvJasmine.cx.evaluateString(EnvJasmine.currentScope, specLoader, 'Loading '+pathToSpecFile, 0, null);
            print("running the jasmine tests");
			var pathToEnvHtml = envHtml.split("\\").join("/");
            var windowLoader = 'window.location.assign(["file://", "'+pathToEnvHtml+'"].join("/"));';
            EnvJasmine.cx.evaluateString(EnvJasmine.currentScope, windowLoader, 'Executing '+pathToSpecFile, 0, null);
        } catch (e) {
            print('error running jasmine test: ' + EnvJasmine.specs[i] + "\n error was: " + e );
			print(e.stack);
        }
        finally {
            if (fileIn) {
              fileIn.close();
              fileIn = null;
            }
        }
    }

    if (EnvJasmine.results.length > 0) {
        print("\n");
        print(EnvJasmine.red(EnvJasmine.results.join("\n\n")));
    }

    print();
    print(EnvJasmine[EnvJasmine.passedCount ? 'green' : 'plain']("Passed: " + EnvJasmine.passedCount));
    print(EnvJasmine[EnvJasmine.failedCount ? 'red' : 'plain']("Failed: " + EnvJasmine.failedCount));
    print(EnvJasmine.plain("Total : " + EnvJasmine.totalCount));

    return EnvJasmine.failedCount;
};
