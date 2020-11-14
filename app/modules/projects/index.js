// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require) {
  var Origin = require('core/origin');
  var ProjectsView = require('./views/projectsView');
  var ProjectsSidebarView = require('./views/projectsSidebarView');
  var ContentCollection = require('core/collections/contentCollection');
  var TagsCollection = require('core/collections/tagsCollection');

  Origin.on('router:dashboard', function(location, subLocation, action) {
    Origin.trigger('editor:resetData');
    Origin.options.addItems([
      {
        title: Origin.l10n.t('app.grid'),
        icon: 'th',
        callbackEvent: 'dashboard:layout:grid',
        value: 'grid',
        group: 'layout',
      },
      {
        title: Origin.l10n.t('app.list'),
        icon: 'list',
        callbackEvent: 'dashboard:layout:list',
        value: 'list',
        group: 'layout'
      },
      {
        title: Origin.l10n.t('app.ascending'),
        icon: 'sort-alpha-asc',
        callbackEvent: 'dashboard:sort:asc',
        value: 'asc',
        group: 'sort'
      },
      {
        title: Origin.l10n.t('app.descending'),
        icon: 'sort-alpha-desc',
        callbackEvent: 'dashboard:sort:desc',
        value: 'desc',
        group: 'sort'
      },
      {
        title: Origin.l10n.t('app.recent'),
        icon: 'edit',
        callbackEvent: 'dashboard:sort:updated',
        value: 'updated',
        group: 'sort'
      }
    ]);
    (new TagsCollection()).fetch({
      success: function(collection) {
        Origin.sidebar.addView(new ProjectsSidebarView({ collection }).$el);
        Origin.trigger('dashboard:loaded', { type: location || 'all' });
      },
      error: function() {
        console.log('Error occured getting the tags collection - try refreshing your page');
      }
    });
  });

  Origin.on('dashboard:loaded', function (options) {
    var isMine = options.type === 'all';
    var isShared = options.type === 'shared';
    if(!isMine && !isShared) {
      return;
    }
    var titleKey = isMine ? 'myprojects' : 'sharedprojects';
    var meId = Origin.sessionModel.get('user')._id;
    var coll = new ContentCollection(undefined, { 
      _type: 'course',
      filter: { createdBy: isMine ? meId : { $ne: meId } }
    });
    Origin.trigger('location:title:update', { breadcrumbs: ['dashboard'], title: Origin.l10n.t('app.' + titleKey) });
    Origin.contentPane.setView(ProjectsView, { collection: coll, _isShared: isShared });
  });

  Origin.on('globalMenu:dashboard:open', () => Origin.router.navigateTo('dashboard'));

  Origin.on('router:initialize login:changed', function() {
    Origin.globalMenu.addItem({
      "location": "global",
      "text": Origin.l10n.t('app.dashboard'),
      "icon": "fa-home",
      "callbackEvent": "dashboard:open",
      "sortOrder": 1
    });
    Origin.router.setHomeRoute('dashboard');
  });
});
