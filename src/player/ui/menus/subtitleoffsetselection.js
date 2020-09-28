import shaka from 'shaka-player/dist/shaka-player.ui.debug';
import { setDisplay, focusOnTheChosenItem } from '@/player/ui/utils';

const subtitleOffsets = {
  '+ 50': 50,
  '- 50': -50,
  Reset: 0,
};

export default (store) => {
  class SubtitleOffsetSelection extends shaka.ui.SettingsMenu {
    #watcherCancellers = [];

    constructor(parent, controls) {
      super(parent, controls, 'timer');

      this.#watcherCancellers = [
        store.watch(
          (state, getters) => getters['slplayer/IS_SUBTITLE_STREAM_NATIVE_SIDECAR'],
          this.updateSubtitleOffsetSelection.bind(this),
        ),

        store.watch(
          (state) => state.slplayer.subtitleOffset,
          this.updateSubtitleOffset.bind(this),
        ),
      ];

      this.button.classList.add('shaka-subtitle-offset-button');
      this.menu.classList.add('shaka-subtitle-offset');

      this.updateSubtitleOffset();
      this.addSubtitleOffsetSelection();
      this.updateSubtitleOffsetSelection();
    }

    updateSubtitleOffset() {
      const offsetLabel = `${store.state.slplayer.subtitleOffset}ms`;
      this.currentSelection.textContent = offsetLabel;
      this.backSpan.textContent = `Subtitle Offset: ${offsetLabel}`;
      this.nameSpan.textContent = 'Subtitle Offset';
    }

    updateSubtitleOffsetSelection() {
      // Hide menu if there is nothing to choose or burning subtitles
      if (!store.getters['slplayer/IS_SUBTITLE_STREAM_NATIVE_SIDECAR']) {
        setDisplay(this.menu, false);
        setDisplay(this.button, false);
        return;
      }

      // Otherwise, restore it.
      setDisplay(this.button, true);

      focusOnTheChosenItem(this.menu);
    }

    addSubtitleOffsetSelection() {
      Object.entries(subtitleOffsets).forEach(([name, offsetIncrement]) => {
        const button = document.createElement('button');
        button.classList.add('explicit-subtitle-offset');

        const span = document.createElement('span');
        span.textContent = name;
        button.appendChild(span);

        this.eventManager.listen(
          button,
          'click',
          () => SubtitleOffsetSelection.onSubtitleOffsetClicked(offsetIncrement),
        );

        this.menu.appendChild(button);
      });
    }

    static onSubtitleOffsetClicked(offsetIncrement) {
      return store.dispatch('slplayer/CHANGE_SUBTITLE_OFFSET', offsetIncrement);
    }

    release() {
      this.#watcherCancellers.forEach((canceller) => {
        canceller();
      });

      super.release();
    }
  }

  const factory = {
    create: (rootElement, controls) => new SubtitleOffsetSelection(rootElement, controls),
  };

  shaka.ui.OverflowMenu.registerElement('subtitleoffset', factory);
};
