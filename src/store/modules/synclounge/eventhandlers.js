export default {
  HANDLE_SUCCESSFUL_JOIN_RESULT: ({
    getters, state, commit, dispatch,
  }, {
    _data, currentUsers, partyPausing,
  }) => {
    commit('CLEAR_MESSAGES');

    commit('SET_USERS', currentUsers);
    commit('SET_PARTYPAUSING', partyPausing);
    commit('SET_ROOM', _data.room);

    console.log(_data.room);
    dispatch('DISPLAY_NOTIFICATION', `Joined room: ${_data.room}`, { root: true });
    // Add this item to our recently-connected list
    dispatch(
      'settings/ADD_RECENT_ROOM',
      {
        server: state.server,
        room: state.room,
        password: state.password,
        time: new Date().getTime(),
      },
      { root: true },
    );

    getters.GET_SOCKET.on('poll-result', (users, me, commandId) => {
      dispatch('HANDLE_POLL_RESULT', { users, me, commandId });
    });

    getters.GET_SOCKET.on('party-pausing-changed', (res) => {
      dispatch('HANDLE_PARTY_PAUSING_CHANGED', res);
    });

    getters.GET_SOCKET.on('party-pausing-pause', (res) => {
      dispatch('HANDLE_PARTY_PAUSING_PAUSE', res);
    });

    getters.GET_SOCKET.on('user-joined', (users, user) => {
      dispatch('HANDLE_USER_JOINED', { users, user });
    });

    getters.GET_SOCKET.on('user-left', (users, user) => {
      dispatch('HANDLE_USER_LEFT', { users, user });
    });

    getters.GET_SOCKET.on('host-swap', (user) => {
      dispatch('HANDLE_HOST_SWAP', user);
    });

    state.socket.on('host-update', (hostData) => {
      dispatch('HANDLE_HOST_UPDATE', hostData);
    });

    state.socket.on('disconnect', (disconnectData) => {
      dispatch('HANDLE_DISCONNECT', disconnectData);
    });

    state.socket.on('new_message', (msgObj) => {
      commit('ADD_MESSAGE', msgObj);
    });

    dispatch('START_CLIENT_POLLER');
  },

  HANDLE_POLL_RESULT: ({ commit, getters }, { users, commandId }) => {
    // Now we need to setup events for dealing with the PTServer.
    // We will regularly be recieving and sending data to and from the server.
    // We want to make sure we are listening for all the server events

    commit('UPDATE_SRTT', Date.now() - getters.GET_POLL_SENT_TIME(commandId));
    commit('DELETE_UNACKED_POLL', commandId);

    commit('SET_USERS', users);
  },

  HANDLE_PARTY_PAUSING_CHANGED: ({ commit }, { value, user }) => {
    commit('ADD_MESSAGE', {
      msg: `Party Pausing has been turned ${value ? 'on' : 'off'}`,
      user,
      type: 'alert',
    });

    commit('SET_PARTYPAUSING', value);
  },

  HANDLE_PARTY_PAUSING_PAUSE: ({ commit, dispatch, rootGetters }, { isPause, user }) => {
    const messageText = `${user.username} pressed ${isPause ? 'pause' : 'play'}`;
    commit('ADD_MESSAGE', {
      msg: messageText,
      user,
      type: 'alert',
    });

    dispatch('DISPLAY_NOTIFICATION', messageText, { root: true });
    if (rootGetters.GET_CHOSEN_CLIENT) {
      if (isPause) {
        rootGetters.GET_CHOSEN_CLIENT.pressPause();
      } else {
        rootGetters.GET_CHOSEN_CLIENT.pressPlay();
      }
    }
  },

  HANDLE_USER_JOINED: ({ commit }, { users, user }) => {
    commit('SET_USERS', users);
    commit('ADD_MESSAGE', {
      msg: `${user.username} joined`,
      user,
      type: 'alert',
    });
  },

  HANDLE_USER_LEFT: ({ commit }, { users, user }) => {
    commit('SET_USERS', users);
    commit('ADD_MESSAGE', {
      msg: `${user.username} left the room`,
      user,
      type: 'alert',
    });
  },

  HANDLE_HOST_SWAP: ({ commit }, user) => {
    if (!user) {
      return;
    }

    commit('ADD_MESSAGE', {
      msg: `${user.username} is now the host`,
      user,
      type: 'alert',
    });
  },

  HANDLE_HOST_UPDATE: ({ getters, commit, dispatch }, timeline) => {
    if (!getters.GET_HOST_TIMELINE
        || getters.GET_HOST_TIMELINE.playerState !== timeline.playerState
        || Math.abs(timeline.time - getters.GET_HOST_TIMELINE.time) < 5000) {
      window.EventBus.$emit('host-playerstate-change');
    }

    commit('SET_HOST_TIMELINE', {
      ...timeline,
      recievedAt: Date.now(),
      // TODO: think about whether I need this or
      srttSnapsnotAtReception: getters.GET_SRTT,
    });

    return dispatch('SYNCHRONIZE');
  },

  SYNCHRONIZE: async ({
    getters, commit, dispatch, rootGetters,
  }) => {
    /* This is data from the host, we should react to this data by potentially changing
        what we're playing or seeking to get back in sync with the host.

        We need to limit how ourself to make sure we dont hit the client too hard.
        We'll only fetch new data if our data is older than 1000ms.
        If we need to fetch new data, we'll do that and then decide
        if we need to seek or start playing something.
      */

    // TODO: move this manual sync into this module
    if (rootGetters.GET_MANUAL_SYNC_QUEUED) {
      window.EventBus.$emit('host-playerstate-change');
      await rootGetters.GET_CHOSEN_CLIENT.seekTo(getters.GET_HOST_TIMELINE.time);
      commit('SET_MANUAL_SYNC_QUEUED', false, { root: true });
      return;
    }

    // console.log('Timeline age is', timelineAge);
    try {
      await dispatch('DECISION_MAKER');
    } catch (e) {
      console.log('Error caught in sync logic', e);
    }
  },

  DECISION_MAKER: async ({
    getters, dispatch, rootGetters,
  }) => {
    // TODO: potentailly don't do anythign if we have no timeline data yet
    const timeline = dispatch('plexclients/FETCH_TIMELINE_POLL_DATA_CACHE', null, { root: true });

    if (getters.GET_HOST_TIMELINE.playerState === 'stopped' && timeline.playerState !== 'stopped') {
    // First, decide if we should stop playback
      dispatch('DISPLAY_NOTIFICATION', 'The host pressed stop', { root: true });
      return dispatch('plexclients/PRESS_STOP', null, { root: true });
    }

    if (rootGetters['settings/GET_AUTOPLAY']
    && (getters.GET_HOST_TIMELINE.ratingKey !== getters.GET_HOST_LAST_RATING_KEY
      || timeline.playerState === 'stopped')) {
      // If we have autoplay enabled and the host rating key has changed or if we aren't playign anything
      return dispatch('FIND_AND_PLAY_NEW_MEDIA');
    }

    // TODO: examine if we want this or not
    if (timeline.playerState === 'buffering') {
      return false;
    }

    if (getters.GET_HOST_TIMELINE.playerState === 'playing' && timeline.state === 'paused') {
      dispatch('DISPLAY_NOTIFICATION', 'Resuming..', { root: true });
      return dispatch('plexclients/PRESS_PLAY', null, { root: true });
    }

    if ((getters.GET_HOST_TIMELINE.playerState === 'paused'
          || getters.GET_HOST_TIMELINE.playerState === 'buffering')
          && timeline.state === 'playing') {
      dispatch('DISPLAY_NOTIFICATION', 'Pausing..', { root: true });
      return dispatch('plexclients/PRESS_PAUSE', null, { root: true });
    }

    // TODO: since we have awaited,

    // TODO: potentially update the player state if we paused or played so we know in the sync

    return dispatch('plexclients/SYNC', null, { root: true });
  },

  FIND_AND_PLAY_NEW_MEDIA: async ({ getters, dispatch, commit }) => {
    dispatch('DISPLAY_NOTIFICATION', `Searching Plex Servers for "${getters.GET_HOST_TIMELINE.rawTitle}"`, { root: true });

    const bestMatch = await dispatch('plexservers/FIND_BEST_MEDIA_MATCH', getters.GET_HOST_TIMELINE, { root: true });
    if (bestMatch) {
      await dispatch('plexclients/PLAY_MEDIA', {
        // TODO: have timeline updates send out more info like mediaIdentifier etc
        mediaIndex: bestMatch.mediaIndex || 0,
        offset: getters.GET_HOST_TIMELINE.time || 0,
        metadata: bestMatch,
        machineIdentifier: bestMatch.machineIdentifier,
      }, { root: true });
    } else {
      dispatch('DISPLAY_NOTIFICATION',
        `Failed to find a compatible copy of ${getters.GET_HOST_TIMELINE}. If you have access to the content try manually playing it.`,
        { root: true });
    }

    commit('SET_HOST_LAST_RATING_KEY', getters.GET_HOST_TIMELINE.ratingKey);
  },

  HANDLE_DISCONNECT: ({ commit, dispatch }, disconnectData) => {
    dispatch('DISPLAY_NOTIFICATION', 'Disconnected from the SyncLounge server', { root: true });

    console.log('Disconnect data', disconnectData);
    if (disconnectData === 'io client disconnect') {
      console.log('We disconnected from the server');
      commit('SET_ROOM', null);
      commit('SET_PASSWORD', null);
      commit('SET_USERS', []);
      commit('SET_SERVER', null);
    } else if (disconnectData === 'transport close') {
      console.log('The server disconnected on us');
    }
  },
};
