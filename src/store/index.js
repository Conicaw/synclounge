import Vue from 'vue';
import Vuex from 'vuex';
import createPersistedState from 'vuex-persistedstate';

import actions from './actions';
import state from './state';
import mutations from './mutations';
import getters from './getters';
import modules from './modules';

Vue.use(Vuex);

const persistedState = createPersistedState({
  paths: [
    'settings',

    'plex.user',
    'plex.plexAuthToken',
    'plex.clientIdentifier',
    'plex.areDevicesCached',

    'plexclients.clients',

    'plexservers.servers',
    'plexservers.lastServerId',
    'plexservers.blockedServerIds',

    'synclounge.recentRooms',
    'synclounge.areNotificationsEnabled',
    'synclounge.areSoundNotificationsEnabled',

    'slplayer.subtitleSize',
    'slplayer.subtitlePosition',
    'slplayer.subtitleColor',
    'slplayer.streamingProtocol',
  ],
});

const store = new Vuex.Store({
  strict: process.env.NODE_ENV !== 'production',
  state,
  mutations,
  actions,
  getters,
  modules,
  plugins: [
    persistedState,
  ],
});

export default store;
