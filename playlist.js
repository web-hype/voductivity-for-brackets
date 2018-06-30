/*global define, $, document, brackets */

define(function (require, exports, module) {
    
    "use strict";
    
    var PreferencesManager = brackets.getModule("preferences/PreferencesManager"),
        WorkspaceManger = brackets.getModule("view/WorkspaceManager"),
        EventDispatcher = brackets.getModule("utils/EventDispatcher"),
        Mustache = brackets.getModule("thirdparty/mustache/mustache"),
        playlistPreferences = PreferencesManager.getExtensionPrefs('voductivity.playlist'),
        panelHtml = require('text!playlist_panel.html'),
        tableHTML = require('text!playlist_table.html'),
        panelID = "voductivity.playlist",
        _playlist = [],
        _renderList = [],
        _activeIndex = 0,
        _allChecked = false,
        _inactive = false,
        _instance, _panel;
    
    var PlaylistItemType = {
        url: "url",
        embed: "embed",
        video: "video",
        image: "image"
    }
    
    var PreferenceConstant = {
        playlist: "playlist",
        activeIndex: "activeIndex"
    }
    
    function PlaylistItem(link = "", type = PlaylistItemType.url, name, data) {
        this.link = link;
        this.type = type;
        this.name = name;
        this.data = data;
    }
    
    function PlaylistController() {
        if (!_panel) {
            var $panel = $(panelHtml);
            _panel = WorkspaceManger.createBottomPanel(panelID, $panel, 100);
        }
    }
    EventDispatcher.makeEventDispatcher(PlaylistController.prototype);
    
    function cachePlaylist() {
        playlistPreferences.set(PreferenceConstant.playlist, _playlist);
    }
    
    PlaylistController.prototype.loadPlaylistFromCache = function () {
        return new Promise(function(resolve, reject) {
            var cachedList = playlistPreferences.get(PreferenceConstant.playlist);
            var cachedIndex = playlistPreferences.get(PreferenceConstant.activeIndex);
            
            if (typeof(cachedIndex) !== "number") {
                playlistPreferences.definePreference(PreferenceConstant.activeIndex, "number", 0);
            }
            
            _activeIndex = playlistPreferences.get(PreferenceConstant.activeIndex);
            
            if (!cachedList) {
                playlistPreferences.definePreference(PreferenceConstant.playlist, "array", []);
                
                return reject({
                    function: "PlaylistController.loadPlaylistFromCache",
                    error: Error("no-cached-playlist-available")
                });
            }
            
            _playlist = cachedList;
            
            return resolve({
                function: "PlaylistController.loadPlaylistFromCache"
            });
        });
    }
    
    PlaylistController.prototype.activeItemIndex = function (index) {
        if (typeof(index) === "number") {
            _activeIndex = index;
            playlistPreferences.set(PreferenceConstant.activeIndex, _activeIndex);
        }
        
        return _activeIndex;
    }
    
    PlaylistController.prototype.loadActiveItem = function () {
        return new Promise(function(resolve, reject) {
            if (_playlist.length == 0) {
                return reject({
                    function: "PlaylistController.loadActiveItem",
                    error: Error("playlist-empty")
                });
            } else if (_activeIndex >= _playlist.length) {
                return reject({
                    function: "PlaylistController.loadActiveItem",
                    error: RangeError("index-out-of-range"),
                    data: {
                        index: _activeIndex
                    }
                });
            }
            
            var item = _playlist[_activeIndex];
            resolve({
                function: "PlaylistController.loadActiveItem",
                index: _activeIndex,
                item: item
            });
            toggleInactive(false);
        });
    }
    
    function toggleInactive(inactive) {
        _inactive = typeof(inactive) === "boolean" ? inactive : !_inactive;
        $('.voductivity-playlist .btn.stop-running, .voductivity-playlist .btn.reload, .voductivity-playlist .btn.hide-workspace').attr('disabled', _inactive);
        enableDirectionalLoadButton();
        
        if (_inactive) {
            _instance.trigger('idle');
        }
    }
    
    PlaylistController.prototype.setInactive = function () {
        toggleInactive(true);
    }
    
    PlaylistController.prototype.setPlaylist = function (playlist = []) {
        return new Promise(function(resolve, reject) {
            if (!Array.isArray(playlist)) {
                return reject({
                    function: "PlaylistController.setPlaylist",
                    error: Error("invalid-parameter")
                });
            }
            
            _playlist = playlist;
            resolve({
                function: "PlaylistController.setPlaylist"
            });
            
            cachePlaylist();
        });
    }
    
    PlaylistController.prototype.addItem = function (item = PlaylistItem()) {
        return new Promise(function(resolve, reject) {
            if (!item.link.length) {
                return reject({
                    function: "PlaylistController.addItem",
                    error: Error("invalid-parameter")
                });
            }

            _playlist.push(item);
            resolve({
                function: "PlaylistController.addItem",
                data: {
                    item: item,
                    index: (_playlist.length - 1)
                }
            });
            
            cachePlaylist();
        });
    }
    
    PlaylistController.prototype.renderTable = function () {
        _renderList = [];
        
        _playlist.forEach(function(o,i) {
            var data = {
                index: i,
                isActive: (!_inactive && i == _activeIndex),
                item: o
            };
            _renderList.push(Object.assign(data, o));
        });
        
        var panel = WorkspaceManger.getPanelForID(panelID),
            $table = panel.$panel.find('.table-container'),
            index = 0,
            data = { list: _renderList };
        $table.html(Mustache.render(tableHTML, data));
    }
    
    PlaylistController.prototype.initialiseListeners = function () {
        var self = this,
            panel = WorkspaceManger.getPanelForID(panelID);
        
        panel.$panel.off('.voductivity-panel')
            .on("click.voductivity-panel", ".close", function () {
                self.closePanel();
            })
            .on("click.voductivity-panel", ".check-all", function () {
                _allChecked = $('.voductivity-playlist .check-all').is(':checked');
                self.renderTable();
                enableRemoveButton(_allChecked);
            })
            .on("click.voductivity-panel", ".check-one", function () {
            
            var $checkedInputs = $('.voductivity-playlist .check-one').filter(':checked'),
                hasCheckedItem = $checkedInputs.length > 0;
            
                _allChecked = $checkedInputs.length == _playlist.length;
                $('.voductivity-playlist .check-all').prop('checked', _allChecked);
                
                enableRemoveButton(hasCheckedItem);
            })
            .on("click.voductivity-panel", ".btn.load", function () {
                var $this = $(this),
                    activeIndex = self.activeItemIndex();
            
                if ($this.hasClass('previous')) {
                    activeIndex--;
                } else if ($this.hasClass('next')) {
                    activeIndex++;
                }
            
                self.activeItemIndex(activeIndex);
            
                triggerReload();
            
                if ($this.hasClass('reload')) {
                    return;
                }
            
                enableDirectionalLoadButton();
                self.renderTable();
            })
            .on("click.voductivity-panel", ".btn.display-this", function () {
                var index = parseInt($(this).parents('tr').attr('data-item-index'));
                self.activeItemIndex(index);
                
                triggerReload();
                self.renderTable();
                enableDirectionalLoadButton();
            })
            .on("click.voductivity-panel", ".btn.hide-workspace", function () {
                self.trigger("hideworkspace");
            })
            .on("click.voductivity-panel", ".btn.stop-running", function () {
                toggleInactive(true);
                self.renderTable();
            })
            .on("click.voductivity-panel", ".btn.add-dialog", function () {
                self.trigger("adddialog");
            })
            .on("click.voductivity-panel", ".btn.remove-checked", function () {
                enableRemoveButton(false);
            
                if (_allChecked) {
                    clearAllChecked();
                    toggleInactive(true);
                    self.setPlaylist().then(function() {
                        self.renderTable();
                    });;
                    return; 
                }
            
                var clonedList = _playlist,
                    checkedIndicies = [],
                    $checkedItems = $('.voductivity-playlist .check-one').filter(':checked'),
                    checkedLength = $checkedItems.length;
                $checkedItems.each(function(i) {
                    var itemIndex = parseInt($(this).parents('tr').attr('data-item-index'));
                    
                    if (itemIndex == _activeIndex) {
                        toggleInactive(true);
                    }
                    
                    checkedIndicies.push(itemIndex);
                    
                    if (i >= (checkedLength - 1)) {
                        var filteredList = _renderList.filter(function(o) {
                            return checkedIndicies.indexOf(o.index) < 0;
                        }),
                            remappedList = filteredList.map(function(o) {
                                return o.item;
                            });
                        
                        self.setPlaylist(remappedList).then(function() {
                            self.renderTable();
                        });
                    }
                });
            });
    }
    
    function triggerReload() {
        toggleInactive(false);
        _instance.trigger('reload');
    }
    
    function clearAllChecked() {
        _allChecked = false;
        $('.voductivity-playlist .check-all').prop("checked", false);
    }
    
    function enableRemoveButton(enable) {
        var $removeBtn = $('.voductivity-playlist .remove-checked');
        if (enable) {
            $removeBtn.removeAttr('disabled');
        } else {
            $removeBtn.attr('disabled','');
        }
    }
    
    function enableDirectionalLoadButton() {
        var disablePrevious = _inactive || _activeIndex <= 0,
            disableNext = _inactive || _activeIndex >= (_playlist.length - 1);
        $('.voductivity-playlist .btn.load.previous').attr('disabled', disablePrevious);
        $('.voductivity-playlist .btn.load.next').attr('disabled', disableNext);
    }
    
    function willOpenPanel() {
        _instance.initialiseListeners();
        _instance.renderTable();
        enableDirectionalLoadButton();
    }
    
    function didClosePanel() {
        clearAllChecked();
        _instance.trigger('closed');
    }
    
    PlaylistController.prototype.togglePanel = function (open) {
        if (open) {
            willOpenPanel();
        }
        _panel.setVisible(open);
        if (!open) {
            didClosePanel();
        }
    }
    
    PlaylistController.prototype.openPanel = function () {
        willOpenPanel();
        _panel.show();
    }
    
    PlaylistController.prototype.closePanel = function () {
        _panel.hide();
        didClosePanel();
    }
    
    PlaylistController.prototype.isPanelOpen = function () {
        return _panel.isVisible();
    }
    
    function sharedInstance() {
        if (!_instance) {
            _instance = new PlaylistController();
        }
        
        return _instance;
    }
    
    exports.PlaylistController = sharedInstance();
    exports.PlaylistItem = PlaylistItem;
    exports.PlaylistItemType = PlaylistItemType;
});