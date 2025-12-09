/* eslint-disable no-undef */

var chromeHandle;

function install(data, reason) { }

async function startup({ id, version, resourceURI, rootURI }, reason) {
    await Zotero.initializationPromise;

    if (!rootURI) {
        rootURI = resourceURI.spec;
    }

    var aomStartup = Components.classes[
        "@mozilla.org/addons/addon-manager-startup;1"
    ].getService(Components.interfaces.amIAddonManagerStartup);
    var manifestURI = Services.io.newURI(rootURI + "manifest.json");
    chromeHandle = aomStartup.registerChrome(manifestURI, [
        ["content", "__addonRef__", rootURI + "content/"],
    ]);

    const ctx = {
        rootURI,
    };
    ctx._globalThis = ctx;

    Services.scriptloader.loadSubScript(
        `${rootURI}/content/scripts/__addonRef__.js`,
        ctx,
    );
}

async function onMainWindowLoad({ window }, reason) {
}

async function onMainWindowUnload({ window }, reason) {
}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
    if (reason === APP_SHUTDOWN) {
        return;
    }

    if (typeof Zotero === "undefined") {
        Zotero = Components.classes["@zotero.org/Zotero;1"].getService(
            Components.interfaces.nsISupports,
        ).wrappedJSObject;
    }

    Cc["@mozilla.org/intl/stringbundle;1"]
        .getService(Components.interfaces.nsIStringBundleService)
        .flushBundles();

    Cu.unload(`${rootURI}/content/scripts/__addonRef__.js`);

    if (chromeHandle) {
        chromeHandle.destruct();
        chromeHandle = null;
    }
}

function uninstall(data, reason) { }

