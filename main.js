/*global define, $, document, brackets, console */

define(function (require, exports, module) {
    
    "use strict";
    
    var PreferenceItem = {
        currentIndex: "currentIndex",
        enabled: "enabled",
        defaultTheme: "defaultTheme"
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
        Playlist = require('./playlist'),
        PlaylistController = Playlist.PlaylistController,
        PlaylistItem = Playlist.PlaylistItem,
        PlaylistItemType = Playlist.PlaylistItemType,
        extThemeName = "web-hype.voductivity-theme",
        extCss = "voductivity-enabled",
        workspaceMinimised = false,
        workspacedMinimisedCss = "voductivity-workspace-minimised",
        panelOpenCss = 'voductivity-panel-open',
        CommandId_ToggleWorkspaceVisibility = "voductivity.toggleworkspacevisibility",
        Command_Id_ToggleEnabled = "voductivity.toggleenabled",
        Command_Id_OpenPlaylist = "voductivity.openplaylist",
        Command_Id_OpenAddDialog = "voductivity.openadddialog",
        Command_ToggleWorkspaceVisibility, Command_ToggleEnabled, Command_OpenPlaylist, Command_OpenAddDialog,
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

        var $container = $(document.createElement('div'))
            .attr('id','voductivity-media-container');
        $('body').addClass(extCss)
            .prepend($container);
        
        displayActiveItem();
    }
    
    var tearDown = function() {
        var defaultTheme = extPreferences.get(PreferenceItem.defaultTheme);
        PreferencesManager.set("themes.theme", defaultTheme);
        $('body').removeClass(extCss + ' ' + workspacedMinimisedCss);
        $('#voductivity-media-container').remove();
        PlaylistController.setInactive();
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
            return console.error(e.function + ': ' + e.error.message);
        }).then(function(data) {
            itemData = data.item;
            
            var itemData = data.item,
                src = itemData.link,
                iframeTag = 'iframe',
                containerRef = '#voductivity-media-container',
                html, tag;
            
            $(containerRef).empty();

            switch(itemData.type) {
                case PlaylistItemType.embed:
                    $(src).find(iframeTag)
                        .addBack(iframeTag).appendTo(containerRef);
                    return;
                case PlaylistItemType.video:
                    var $source = $(document.createElement('source')).attr('src', src),
                        $element = $(document.createElement('video'))
                        .addClass('voductivity')
                        .attr('controls', '')
                        .attr('autoplay', '')
                        .append($source)
                        .appendTo(containerRef);
                    return;
                case PlaylistItemType.image:
                    tag = 'img'
                    break;
                case PlaylistItemType.url:
                default:
                    tag = 'iframe';
                    break;
            }
            
            $(document.createElement(tag))
                .addClass('voductivity')    
                .attr('src', src)
                .appendTo(containerRef);
        });
    }
    
    var reloadPlaylist = function () {
        
        return PlaylistController.loadPlaylistFromCache().catch(function() {
            return instanciatePlaylist();
        });
    }
    
    var initialise = function () {
        var defaultTheme = extPreferences.get(PreferenceItem.defaultTheme);
        
        if (!extPreferences.get(PreferenceItem.defaultTheme)) {
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
        PlaylistController.setInactive();
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
            if (!PlaylistController.isPanelOpen()) {
                PlaylistController.closePanel();
            } else {
                PlaylistController.openPanel();
            }
        } else {
            $focusedBtn = $toolbarBtn.clone(true)
                .attr('id', 'voductivity-focused-btn')
                .insertAfter('#voductivity-media-container');
            $body.addClass(workspacedMinimisedCss);
        }
        
        workspaceMinimised = !workspaceMinimised;
        Command_ToggleWorkspaceVisibility.setChecked(workspaceMinimised);
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
                Command_OpenPlaylist.setChecked(false);
            })
            .on('adddialog.voductivity', function() {
                openAddDialog();
            })
            .on('hideworkspace.voductivity', function() {
                toogleWorkspaceVisibility();
            });
    }
    
    var openPlaylist = function (open) {
        var open = typeof(open) === "boolean" ? open : !PlaylistController.isPanelOpen();
        setPlaylistListeners(!open);
        PlaylistController.togglePanel(open);
        Command_OpenPlaylist.setChecked(open);
        
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
    
    Command_ToggleEnabled = CommandManager.register("Enable Voductivity",
                                                   Command_Id_ToggleEnabled,
                                                   toggleEnabled);
    Command_ToggleWorkspaceVisibility = CommandManager.register("Hide Workspace",
                                                                CommandId_ToggleWorkspaceVisibility,
                                                                toogleWorkspaceVisibility);
    Command_OpenPlaylist = CommandManager.register("Show Playlist",
                                                   Command_Id_OpenPlaylist,
                                                   openPlaylist);
    Command_OpenAddDialog = CommandManager.register("Add to Playlist",
                                                   Command_Id_OpenAddDialog,
                                                   openAddDialog);
    
    var viewMenu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
    viewMenu.addMenuDivider();
    viewMenu.addMenuItem(Command_Id_ToggleEnabled, "Alt-Shift-V");
    viewMenu.addMenuItem(CommandId_ToggleWorkspaceVisibility, "Alt-Shift-W");
    viewMenu.addMenuItem(Command_Id_OpenPlaylist);
    viewMenu.addMenuItem(Command_Id_OpenAddDialog);
    
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