/*global define, $, document, brackets, console */

define(function (require, exports, module) {
    
    "use strict";
    
    var PreferenceItem = {
        currentIndex: "currentIndex",
        enabled: "enabled",
        defaultTheme: "defaultTheme",
        loadOnLaunch: "loadOnLaunch"
    }
    
    var AppInit = brackets.getModule("utils/AppInit"),
        ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
        CommandManager = brackets.getModule("command/CommandManager"),
        Commands = brackets.getModule("command/Commands"),
        Menus = brackets.getModule("command/Menus"),
        PreferencesManager = brackets.getModule("preferences/PreferencesManager"),
        ThemeManger = brackets.getModule("view/ThemeManager"),
        WorkspaceManger = brackets.getModule("view/WorkspaceManager"),
        extPreferences = PreferencesManager.getExtensionPrefs('voductivity'),
        MC = require('./mediacontainer'),
        MediaContainer = MC.instance,
        MediaDisplayMode = MC.DisplayMode,
        ItemMarkup = require('./itemmarkup'),
        Playlist = require('./playlist'),
        PlaylistController = Playlist.PlaylistController,
        PlaylistItem = Playlist.PlaylistItem,
        PlaylistItemType = Playlist.PlaylistItemType,
        extThemeName = "web-hype.voductivity-theme",
        extCss = "voductivity-enabled",
        workspaceMinimised = false,
        workspacedMinimisedCss = "voductivity-workspace-minimised",
        panelOpenCss = 'voductivity-panel-open',
        Command_Id_ToggleWorkspaceVisibility = "voductivity.toggleworkspacevisibility",
        Command_Id_ToggleEnabled = "voductivity.toggleenabled",
        Command_Id_ToggleLoadOnLaunch = "voductivity.loadonlaunch",
        Command_Id_ToggleFloatingPlayer = "voductivity.togglefloatingplayer",
        Command_ToggleWorkspaceVisibility, Command_ToggleEnabled, Command_ToggleLoadOnLaunch, Command_ToggleFloatingPlayer,
        _extEnabled = false,
        extPlaylistPanel,
        usersThemeName;
    
    var Mustache = brackets.getModule("thirdparty/mustache/mustache"),
        Dialogs = brackets.getModule("widgets/Dialogs"),
        DefaultDialogs = brackets.getModule("widgets/DefaultDialogs"),
        AddDialogHTML = require('text!add_dialog.html');
    
    var saveExtensionPreferences = function () {
        extPreferences.save();
    }
    
    var setup = function() {
        PreferencesManager.set("themes.theme", extThemeName);

        $('body').addClass(extCss)
            .prepend(MediaContainer.element);
        
        openPlaylist(true);
        displayActiveItem();
    }
    
    var tearDown = function() {
        var defaultTheme = extPreferences.get(PreferenceItem.defaultTheme);
        PreferencesManager.set("themes.theme", defaultTheme);
        
        let extClasses = extCss + ' ' + workspacedMinimisedCss + ' ' + panelOpenCss;
        $('body').removeClass(extCss)
            .removeClass(workspacedMinimisedCss);
        $(MediaContainer.element).remove();
        PlaylistController.setInactive();
        
        openPlaylist(false);
    }
    
    var instanciatePlaylist = function() {
        var initialItem = new PlaylistItem('https://demo.web-hype.com/awesomesource/', PlaylistItemType.url, "Awesome Source");
          
        return PlaylistController.addItem(initialItem);
    }
    
    var displayActiveItem = function () {
        PlaylistController.loadActiveItem().catch(function(e) {
            if (e.error.message === "index-out-of-range") {
                PlaylistController.activeItemIndex(0);
                return PlaylistController.loadActiveItem();
            }
            
            return Promise.reject(e);
        }).catch(function(e) {
            if (e.error.message === "playlist-empty") {
                return instanciatePlaylist().then(function() {
                    return PlaylistController.loadActiveItem()
                })
            }
            
            return Promise.reject(e);
        }).catch(function(e) {
            if (e.error.message === "no-active-item") {
                PlaylistController.setInactive();
            }
            
            return Promise.reject(e);
        }).then(function(data) {
            let opts = {
                controls: true,
                autoplay: true
            }
            let element = ItemMarkup.elementForItem(data.item, opts);
            MediaContainer.display(element);
        }).catch(function(e) {
            console.error(e.function + ': ' + e.error.message);
        });
    }
    
    var reloadPlaylist = function () {
        
        return PlaylistController.loadPlaylistFromCache().catch(function() {
            return instanciatePlaylist();
        });
    }
    
    var initialise = function () {
        var defaultTheme = extPreferences.get(PreferenceItem.defaultTheme);
        
        if (!defaultTheme) {
            var currentTheme = ThemeManger.getCurrentTheme();
            var currentThemeName = !!currentTheme && currentTheme.name !== extThemeName ? currentTheme.name : "light-theme";
            extPreferences.definePreference(PreferenceItem.defaultTheme, "string", currentThemeName);
            saveExtensionPreferences();
        }
        
        PreferencesManager.on('change', function() {
            var newTheme = PreferencesManager.get("themes.theme");
            if (newTheme === extThemeName) {
                return;
            }
            
            var defaultThemeName = !!newTheme ? newTheme : "light-theme";
            extPreferences.set(PreferenceItem.defaultTheme, defaultThemeName);
            saveExtensionPreferences();
        });
        
        console.log(ThemeManger.getCurrentTheme());
        
        var themePath = require.toUrl('./theme/theme.less'),
            themeData = require.toUrl('./theme/package.json');
        
        console.log(themePath);
        
        $.getJSON(themeData).then(function(themeMetaData) {
            return ThemeManger.loadFile(themePath, themeMetaData);
        });
        
        reloadPlaylist();
        
        var shouldLoad = extPreferences.get(PreferenceItem.loadOnLaunch);
        if (shouldLoad == null) {
            shouldLoad = false;
            extPreferences.definePreference(PreferenceItem.loadOnLaunch, "bool", shouldLoad);
        }
        
        if (!shouldLoad) {
            PlaylistController.setInactive();
        } else if (!_extEnabled) {
            toggleEnabled();
            displayActiveItem();
        }
        
        updateLoadOnLaunchMenuItem();
        updateMenuItemsForFloatingPlayer();
        
    };
    
    var toggleEnabled = function() {
        _extEnabled = !_extEnabled;
        
        if (_extEnabled) {
            reloadPlaylist().then(function(){
                setup();
            });
        } else {
            tearDown();
        }
        
        Command_ToggleEnabled.setChecked(_extEnabled);
    }
    
    var toogleWorkspaceVisibility = function() {
        if (!_extEnabled) {
            return;
        }
        
        var $body = $('body');
        if (workspaceMinimised) {
            $focusedBtn.remove();
            $body.removeClass(workspacedMinimisedCss);
            WorkspaceManger.recomputeLayout();
        } else {
            $focusedBtn = $toolbarBtn.clone(true)
                .attr('id', 'voductivity-focused-btn')
                .insertAfter('#voductivity-media-container');
            $body.addClass(workspacedMinimisedCss);
        }
        
        workspaceMinimised = !workspaceMinimised;
        Command_ToggleWorkspaceVisibility.setChecked(workspaceMinimised);
    }
    
    function updateMenuItemsForFloatingPlayer() {
        var isFloating = MediaContainer.currentDisplayMode() == MediaDisplayMode.floating;
        
        Command_ToggleFloatingPlayer.setChecked(isFloating);
        Command_ToggleWorkspaceVisibility.setEnabled(!isFloating);
        
        PlaylistController.renderToolbar();
    }
    
    var toggleFloatingPlayer = function() {
        var makeFloating = MediaContainer.currentDisplayMode() != MediaDisplayMode.floating;
        
        if (makeFloating) {
            MediaContainer.makeFloating();
            
            if (workspaceMinimised) {
                toogleWorkspaceVisibility();
            }
            
        } else {
            MediaContainer.makeBackground();
        }
        
        updateMenuItemsForFloatingPlayer();
    }
    
    var setPlaylistListeners = function (off = false) {
        PlaylistController.off('.voductivity');
        if (off) {
            return;
        }
        
        PlaylistController.on('reload.voductivity', function() {
                reloadPlaylist().then(function() {
                    if (_extEnabled) {
                        displayActiveItem();
                    } else {
                        _extEnabled = true;
                        setup(); Command_ToggleEnabled.setChecked(_extEnabled);
                    }
                });
            })
            .on('idle.voductivity', function() {
                if (workspaceMinimised) {
                    toogleWorkspaceVisibility();
                }
                if (_extEnabled) {
                    toggleEnabled();
                }
            })
            .on('closed.voductivity', function() {
            $('body').removeClass(panelOpenCss);
//                Command_OpenPlaylist.setChecked(false);
            })
            .on('adddialog.voductivity', function() {
                openAddDialog();
            })
            .on('hideworkspace.voductivity', function() {
                toogleWorkspaceVisibility();
            })
            .on('togglefloating.voductivity', function() {
                toggleFloatingPlayer();
            });
    }
    
    var openPlaylist = function (open) {
        var open = typeof(open) === "boolean" ? open : !PlaylistController.isPanelOpen();
        setPlaylistListeners(!open);
        PlaylistController.togglePanel(open);
//        Command_OpenPlaylist.setChecked(open);
        
        if (open) {
            $('body').addClass(panelOpenCss);
        } else {
            $('body').removeClass(panelOpenCss);
        }
    }
    
    var openAddDialog = function () {
        var dialog = Dialogs.showModalDialogUsingTemplate(Mustache.render(AddDialogHTML), false),
            $dialog = dialog._$dlg;
        
        dialog.done(function() {
            $dialog.off('.voductivity-dialog');
        });
        
        dialog._$dlg.on('click.voductivity-dialog', '.add-item', function() {
            var link = $dialog.find('#srcArea').val();
            
            if (!link || link.length == 0) {
                dialog.close();
                return Dialogs.showModalDialog(DefaultDialogs.DIALOG_ID_ERROR, 'Add to Playlist - Error', 'Invalid input');
            }
            
            var name = $dialog.find('#nameField').val(),
                type = $dialog.find('.item-types .active a').attr('data-item-type'),
                newItem = new PlaylistItem(link, type, name);
            
            PlaylistController.addItem(newItem)
                .then(function() {
                dialog.close();
                openPlaylist(true);
            });
        })
            .on('click.voductivity-dialog', '.close-dialog', function() {
            dialog.close();
        })
            .on('keyup.voductivity-dialog',function(evt) {
            if (evt.keyCode == 27) {
                // esc pressed
                dialog.close();
            }
        });
    }
    
    function updateLoadOnLaunchMenuItem() {
        Command_ToggleLoadOnLaunch.setChecked(extPreferences.get(PreferenceItem.loadOnLaunch));
    }
    
    var toggleLoadOnLaunch = function () {
        var shouldLoad = extPreferences.get(PreferenceItem.loadOnLaunch);
        
        extPreferences.set(PreferenceItem.loadOnLaunch, !shouldLoad);
        saveExtensionPreferences();
        
        updateLoadOnLaunchMenuItem();
    }
    
    Command_ToggleEnabled = CommandManager.register("Enable Voductivity",
                                                   Command_Id_ToggleEnabled,
                                                   toggleEnabled);
    Command_ToggleLoadOnLaunch = CommandManager.register("Load last active on launch",
                                                         Command_Id_ToggleLoadOnLaunch,
                                                         toggleLoadOnLaunch);
    Command_ToggleFloatingPlayer = CommandManager.register("Floating player",
                                                          Command_Id_ToggleFloatingPlayer,
                                                          toggleFloatingPlayer);
    Command_ToggleWorkspaceVisibility = CommandManager.register("Hide Workspace",
                                                                Command_Id_ToggleWorkspaceVisibility,
                                                                toogleWorkspaceVisibility);
    
    var viewMenu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
    viewMenu.addMenuDivider();
    viewMenu.addMenuItem(Command_Id_ToggleEnabled, "Alt-Shift-V");
    viewMenu.addMenuItem(Command_Id_ToggleLoadOnLaunch);
    viewMenu.addMenuItem(Command_Id_ToggleFloatingPlayer, "Alt-Shift-F");
    viewMenu.addMenuItem(Command_Id_ToggleWorkspaceVisibility, "Alt-Shift-W");
    
    ExtensionUtils.loadStyleSheet(module, "voductivity.css");
    var $toolbarBtn = $(document.createElement("a"))
        .addClass("voductivity-btn")
        .attr("href", "#")
        .attr("title", "Voductivity")
        .on("click", openPlaylist)
        .appendTo($("#main-toolbar .buttons"))
        .text("VOD"),
        $focusedBtn;
    
    AppInit.appReady(initialise);
    
});