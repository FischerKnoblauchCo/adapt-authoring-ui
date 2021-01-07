// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require) {
  var Backbone = require('backbone');
  var ContentPluginCollection = require('core/collections/contentPluginCollection');
  var EditorOriginView = require('../../global/views/editorOriginView');
  var Helpers = require('core/helpers');
  var Origin = require('core/origin');
  var PresetCollection = require('../collections/editorPresetCollection.js');
  var PresetEditView = require('./editorPresetEditView.js');
  var PresetModel = require('../models/editorPresetModel.js');

  var ThemingView = EditorOriginView.extend({
    tagName: 'div',
    className: 'theming',
    settings: {
      presetSelection: null
    },
    events: {
      'change .theme select': 'onThemeChanged',
      'change .preset select': 'onPresetChanged',
      'change .form-container form': 'onFieldChanged',
      'click button.edit': 'showPresetEdit'
    },

    initialize: function() {
      this.listenTo(this, 'dataReady', this.render);
      this.listenTo(Origin, {
        'editorThemingSidebar:views:save': this.saveData,
        'editorThemingSidebar:views:savePreset': this.onSavePresetClicked,
        'editorThemingSidebar:views:resetToPreset': this.restorePresetSettings,
        'editorThemingSidebar:views:cancel': this.setPresetSelection(null),
        'managePresets:edit': this.onEditPreset,
        'managePresets:delete': this.onDeletePreset
      });
      this.loadCollections();

      EditorOriginView.prototype.initialize.apply(this, arguments);
    },

    preRender: function() {
      this.$el.hide();
    },

    render: function() {
      EditorOriginView.prototype.render.apply(this, arguments);

      Origin.trigger('location:title:update', {
        breadcrumbs: ['dashboard','course', { title: Origin.l10n.t('app.themeeditor') }],
        title: Origin.l10n.t('app.themingtitle')
      });
      this.updateRestorePresetButton();
      this.renderForm();
    },

    renderForm: async function() {
      this.removeForm();

      let selectedTheme = this.getSelectedTheme();

      if(!selectedTheme.get('schemaName')) {
        this.$('.theme-selector').removeClass('show-preset-select');
        this.$('.empty-message').show();
        this.$('.editable-theme').hide();
        $('.editor-theming-sidebar-reset').hide();
        return;
      }
      this.$('.theme-selector').addClass('show-preset-select');
      this.$('.empty-message').hide();
      this.$('.editable-theme').show();
      $('.editor-theming-sidebar-reset').show();
      try {
        this.form = await Origin.scaffold.buildForm({
          model: selectedTheme,
          schemaType: selectedTheme.get('schemaName')
        });
      } catch(e) {
        console.log(e);
      }
      if(this.form) {
        this.$('.form-container').html(this.form.el);
      }
      this.$el.find('fieldset:not(:has(>.field))').addClass('empty-fieldset');
      this.$('.theme-customiser').show();
      Origin.trigger('theming:showPresetButton', true);

      let toRestore = this.getDefaultThemeSettings();
      // Only restore theme variables if currently selected theme = saved theme
      if (selectedTheme.get('name') === this.model.get('_theme') && Origin.editor.data.course.get('themeVariables')) {
        toRestore = Origin.editor.data.course.get('themeVariables');
      }
      _.defer(function() { this.restoreFormSettings(toRestore); }.bind(this));
    },

    removeForm: function() {
      this.$('.form-container').empty();
      this.$('.theme-customiser').hide();

      this.form = null;

      Origin.trigger('theming:showPresetButton', false);
    },

    postRender: function() {
      this.updateSelects();
      this.setViewToReady();
      this.$el.show();
    },

    loadCollections: function() {
      this.themes = new ContentPluginCollection(undefined, { type: 'theme' });
      this.presets = new PresetCollection();

      this.themes.fetch({
        success: () => {
          this.presets.fetch({
            success: () => this.trigger('dataReady'),
            error: this.onError
          });
        },
        error: this.onError
      });
    },

    updateSelects: function() {
      this.updateThemeSelect();
      this.updatePresetSelect();
    },

    updateThemeSelect: function() {
      var select = this.$('.theme select');
      var oldVal = select.val();
      // remove options first
      $('option', select).remove();
      // add 'no presets'
      select.append($('<option>', { value: "", disabled: 'disabled', selected: 'selected' }).text(Origin.l10n.t('app.selectinstr')));
      // add options
      this.themes.models.forEach(function(item) {
        if (item.get('_isAvailableInEditor') === false) return;
        select.append($(`<option data-name="${item.get('name')}">`, { value: item.get('name') }).text(item.get('displayName')));
      }, this);
      // disable if no options
      select.attr('disabled', this.themes.models.length === 0);
      // restore the previous value
      if (oldVal) return select.val(oldVal);
      // select current theme
      var selectedTheme = this.getSelectedTheme();
      if (selectedTheme) select.val(selectedTheme.get('displayName'));
    },

    updatePresetSelect: function() {
      var theme = this.$('.theme select').val();
      var presets = this.presets.where({ parentTheme: theme });
      var select = this.$('.preset select');
      // remove options first
      $('option', select).remove();
      // add 'no presets'
      select.append($('<option>', { value: "", selected: 'selected' }).text(Origin.l10n.t('app.nopresets')));
      // add options
      presets.forEach(function(item) {
        select.append($('<option>', { value: item.get('_id') }).text(item.get('displayName')));
      }, this);
      // disable delete, hide manage preset buttons if empty
      if (presets.length <= 0) {
        select.attr('disabled', true);
        this.$('button.edit').hide();
        return;
      }
      var selectedPreset = this.getSelectedPreset();
      if (selectedPreset && selectedPreset.get('parentTheme') === theme) {
        const id = selectedPreset.get('_id');
        $.get(`api/coursethemepresets/${id}`, () => select.val(id)).error(() => this.removePresetOption(id));
      }
      select.attr('disabled', false);
      this.$('button.edit').show();
    },

    restoreFormSettings: function(toRestore) {
      if (!this.form || !this.form.el) return;

      for (var key in toRestore) {
        // Check for nested properties
        if (typeof toRestore[key] === 'object') {
          for (var innerKey in toRestore[key]) {
            this.restoreField(this.form.fields[innerKey], toRestore[key][innerKey], innerKey);
          }
        } else {
          this.restoreField(this.form.fields[key], toRestore[key], key)
        }
      }
    },

    restoreField: function(fieldView, value, key) {
      if (!fieldView) {
        return;
      }
      var inputType = fieldView.schema.inputType.type || fieldView.schema.inputType;
      if (inputType === 'ColourPicker') {
        fieldView.setValue(value);
      } else if (inputType.indexOf('Asset') > -1) {
        fieldView.setValue(value);
        fieldView.render();
        $(`div[data-editor-id*="${key}"]`).append(fieldView.editor.$el);
      } else {
        fieldView.editor.$el.val(value.toString())
      }
    },

    showPresetEdit: function(event) {
      event && event.preventDefault();
      var parentTheme = this.getSelectedTheme().get('theme');
      var presets = new Backbone.Collection(this.presets.where({ parentTheme: parentTheme }));
      var view = new PresetEditView({ model: new Backbone.Model({ presets })});
      $('body').append(view.el);
    },

    restorePresetSettings: function(event) {
      event && event.preventDefault();
      Origin.Notify.confirm({
        type: 'warning',
        text: Origin.l10n.t('app.restorepresettext'),
        callback: confirmed => {
          if (!confirmed) {
            return;
          }
          var preset = this.getSelectedPreset();
          var settings = (preset) ? preset.get('properties') : this.getDefaultThemeSettings();
          this.updateRestorePresetButton(false);
          this.restoreFormSettings(settings);
        }
      });
    },

    /**
    * Data persistence
    */

    validateForm: function() {
      if (!this.getSelectedTheme()) {
        Origin.Notify.alert({ type: 'error', text: Origin.l10n.t('app.errornothemeselected') });
        return false;
      }
      return true;
    },

    savePreset: function(presetName) {
      this.form.commit();
      var presetModel = new PresetModel({
        displayName: presetName,
        parentTheme: this.getSelectedTheme().get('theme'),
        properties: this.extractData(this.form.model.attributes)
      });
      presetModel.save(null, {
        success: () => {
          this.presets.add(presetModel);
          this.updateRestorePresetButton(false);
          this.setPresetSelection(presetModel.get('_id'));
          window.setTimeout(() => this.$('.preset select').val(presetModel.get('_id')), 1);
        },
        error: this.onError
      });
    },

    saveData: async function(event) {
      event && event.preventDefault();

      if (!this.validateForm()) {
        return Origin.trigger('sidebar:resetButtons');
      }
      try {
        await this.postThemeData();
        await this.postPresetData();
        await this.postSettingsData();
        this.onSaveSuccess();
      } catch(e) {
        this.onSaveError();
      }
    },

    postThemeData: function() {
      return new Promise((resolve, reject) => {
        console.log(this.model);
        const oldTheme = this.model.get('_theme');
        const newTheme = this.getSelectedTheme().get('name');
        $.ajax({
          url: `api/content/${this.model.get('_id')}`,
          method: 'PATCH',
          data: { 
            _theme: newTheme,
            _enabledPlugins: [...this.model.get('_enabledPlugins').filter(p => p !== oldTheme), newTheme]
          },
          success: () => resolve(),
          error: () => reject()
        });
      });
    },

    postPresetData: function() {
      return new Promise((resolve, reject) => {
        var selectedPreset = this.getSelectedPreset(false);
        if(!selectedPreset) {
          return resolve();
        }
        $.post(`api/coursethemepresets/${selectedPreset.get('_id')}/apply/${this.model.get('_courseId')}`)
          .error(() => reject())
          .done(() => resolve());
      });
    },

    postSettingsData: function() {
      return new Promise((resolve, reject) => {
        if (!this.form) {
          return resolve();
        }
        this.form.commit();
        var settings = this.extractData(this.form.model.attributes);
        Origin.editor.data.course.set('themeVariables', settings);
        Origin.editor.data.course.save(null, { error: () => reject(), success: () => resolve() });
      });
    },

    extractData: function(attributes) {
      var data = {};
      var properties = attributes.properties.variables;
      for (var key in properties) {
        // Check for nested properties
        if (typeof properties[key].properties !== 'undefined') {
            data[key] = {};
            for (var innerKey in properties[key].properties) {
            data[key][innerKey] = attributes[innerKey];
          }
        } else {
          data[key] = attributes[key];
        }
      }
      return data;
    },

    navigateBack: function(event) {
      event && event.preventDefault();
      Backbone.history.history.back();
      this.remove();
    },

    isDataLoaded: function() {
      return this.themes.ready === true && this.presets.ready === true;
    },

    getSelectedTheme: function() {
      return this.themes.findWhere({ name: $('select#theme', this.$el).attr('data-name') || this.model.get('_theme') });
    },
    // param used to only return the val() (and ignore model data)
    getSelectedPreset: function(includeCached) {
      var storedId = this.getPresetSelection();
      var presetId = $('select#preset', this.$el).val();
      if (storedId) {
        return this.presets.findWhere({ '_id': storedId });
      }
      if (presetId) {
        return this.presets.findWhere({ '_id': presetId });
      }
      if (includeCached !== false){
        var selectedTheme = this.getSelectedTheme();
        if (!selectedTheme) return;
        var parent = selectedTheme.get('theme');
        return this.presets.findWhere({ '_id': this.model.get('_themePreset'), parentTheme: parent });
      }
    },

    getDefaultThemeSettings: function() {
      var defaults = {};
      var props;
      try {
        props = this.getSelectedTheme().get('properties').variables;
      } catch(e) {
        return defaults;
      }
      Object.keys(props).forEach(k => {
        if (typeof props[k].properties !== 'object') {
          defaults[k] = props[k].default;
          return;
        }
        // Check for nested properties
        defaults[k] = {};
        Object.keys(props[k].properties).forEach(k2 => defaults[k][k2] = props[k].properties[k2].default);
      });
      return defaults;
    },

    getCurrentSettings: function() {
      if (!this.form) {
        return Origin.editor.data.course.get('themeVariables');
      }
      return _.mapObject(this.form.fields, field => field.getValue());
    },

    themeIsEditable: function(theme) {
      var props = theme && theme.get('properties');
      return props && props.variables;
    },

    flattenNestedProperties: function(properties) {
      var flatProperties = {};
      if (typeof properties !== 'undefined') {
        for (var key in properties) {
          // Check for nested properties
          if (typeof properties[key] === 'object') {
            for (var innerKey in properties[key]) {
              flatProperties[innerKey] = properties[key][innerKey];
            }
          } else {
            flatProperties[key] = properties[key];
          }
        }
      }
      return flatProperties;
    },

    updateRestorePresetButton: function(shouldShow) {
      // no flag, so compare default settings with current settings to determine restore button visibility
      if (typeof shouldShow === 'undefined') {
        var currentSettings = this.flattenNestedProperties(this.getCurrentSettings());
        var preset = this.getSelectedPreset();
        var baseSettings = this.flattenNestedProperties((preset) ? preset.get('properties') : this.getDefaultThemeSettings());
        shouldShow = !_.isEqual(currentSettings, baseSettings);
      }
      var $reset = $('.editor-theming-sidebar-reset');
      shouldShow ? $reset.css('visibility', 'visible') : $reset.css('visibility', 'hidden');
    },

    getPresetSelection: function() {
      return this.settings.presetSelection;
    },

    setPresetSelection: function(id) {
      this.settings.presetSelection = id;
    },

    /**
    * Event handling
    */

    onEditPreset: function(data) {
      var model = this.presets.findWhere({ displayName: data.oldValue });
      model.set('displayName', data.newValue);
      model.save();
    },

    onDeletePreset: function(preset) {
      var toDestroy = this.presets.findWhere({ displayName: preset });
      this.removePresetOption(toDestroy.get('_id'));
      toDestroy.destroy();
    },

    removePresetOption: function(id) {
      var select = this.$('.preset select');
      if (select.val() === id) {
          select.val('');
      }
      select.find('option[value="' + id + '"]').remove();
    },

    onError: function(collection, response, options) {
      Origin.Notify.alert({ type: 'error', text: response });
    },

    onThemeChanged: function() {
      this.setPresetSelection(null);
      this.updatePresetSelect();
      this.renderForm();
      this.updateRestorePresetButton(false);
    },

    onPresetChanged: function(event) {
      var preset = this.presets.findWhere({ _id: $(event.currentTarget).val() });
      var settings = preset && preset.get('properties') || this.getDefaultThemeSettings();
      this.setPresetSelection($(event.currentTarget).val());
      this.restoreFormSettings(settings);
      this.updateRestorePresetButton(false);
    },

    onFieldChanged: function() {
      this.updateRestorePresetButton();
    },

    onSavePresetClicked: function() {
      var self = this;
      Origin.Notify.alert({
        type: 'input',
        text: Origin.l10n.t('app.presetinputtext'),
        closeOnConfirm: false,
        showCancelButton: true,
        callback: function(presetName) {
          if (presetName === false) return;
          if (presetName === "") return swal.showInputError(Origin.l10n.t('app.invalidempty'));
          var theme = self.$('.theme select').val();
          var presets = self.presets.where({ parentTheme: theme, displayName: presetName });
          if (presets.length > 0) {
            swal.showInputError(Origin.l10n.t('app.duplicatepreseterror'));
          } else {
            // watch out for injection attacks
            self.savePreset(Helpers.escapeText(presetName));
            swal.close();
          }
        }
      });
    },

    onSaveError: function() {
      Origin.Notify.alert({ type: 'error', text: Origin.l10n.t('app.errorsave') });
      this.navigateBack();
    },

    onSaveSuccess: function() {
      Origin.trigger('editingOverlay:views:hide');
      Origin.trigger('editor:refreshData', this.navigateBack.bind(this), this);
    }
  }, {
    template: 'editorTheming'
  });

  return ThemingView;
});
