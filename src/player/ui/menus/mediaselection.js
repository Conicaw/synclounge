import shaka from 'shaka-player/dist/shaka-player.ui.debug';
import {
  setDisplay, getDescendantIfExists, removeAllChildren, focusOnTheChosenItem, checkmarkIcon,
} from '@/player/ui/utils';

export default (store) => {
  class MediaSelection extends shaka.ui.SettingsMenu {
    #watcherCancellers = [];

    constructor(parent, controls) {
      super(parent, controls, 'view_list');

      this.#watcherCancellers = [
        store.watch(
          (state, getters) => getters['slplayer/GET_MEDIA_LIST'],
          this.updateMediaSelection.bind(this),
        ),

        store.watch(
          (state) => state.slplayer.mediaIndex,
          this.updateMediaSelection.bind(this),
        ),
      ];

      this.button.classList.add('shaka-media-button');
      this.menu.classList.add('shaka-media');

      this.backSpan.textContent = 'Version';
      this.nameSpan.textContent = 'Version';

      this.updateMediaSelection();
    }

    updateMediaSelection() {
      // Hide menu if there is only the one version
      if (store.getters['slplayer/GET_MEDIA_LIST'].length <= 1) {
        setDisplay(this.menu, false);
        setDisplay(this.button, false);
        return;
      }

      // Otherwise, restore it.
      setDisplay(this.button, true);

      // Remove old shaka-resolutions
      // 1. Save the back to menu button
      const backButton = getDescendantIfExists(this.menu, 'shaka-back-to-overflow-button');

      // 2. Remove everything
      removeAllChildren(this.menu);

      // 3. Add the backTo Menu button back
      this.menu.appendChild(backButton);

      this.addMediaSelection();

      focusOnTheChosenItem(this.menu);
    }

    addMediaSelection() {
      store.getters['slplayer/GET_MEDIA_LIST'].forEach((media) => {
        const button = document.createElement('button');
        button.classList.add('explicit-media');

        const span = document.createElement('span');
        span.textContent = media.text;
        button.appendChild(span);

        this.eventManager.listen(
          button,
          'click',
          () => MediaSelection.onMediaClicked(media.index),
        );

        if (media.index === store.state.slplayer.mediaIndex) {
          button.setAttribute('aria-selected', 'true');
          button.appendChild(checkmarkIcon());
          span.classList.add('shaka-chosen-item');
          this.currentSelection.textContent = span.textContent;
        }

        this.menu.appendChild(button);
      });
    }

    static onMediaClicked(index) {
      store.dispatch('slplayer/CHANGE_MEDIA_INDEX', index);
    }

    release() {
      this.#watcherCancellers.forEach((canceller) => {
        canceller();
      });

      super.release();
    }
  }

  const factory = {
    create: (rootElement, controls) => new MediaSelection(rootElement, controls),
  };

  shaka.ui.OverflowMenu.registerElement('media', factory);
};
