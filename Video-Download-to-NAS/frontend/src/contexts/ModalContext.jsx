import React, { createContext, useContext, useState, useCallback } from 'react';
import InputModal from '../components/modals/InputModal';
import ConfirmModal from '../components/modals/ConfirmModal';
import VideoPlayerModal from '../components/modals/VideoPlayerModal';
import UserManagementModal from '../components/modals/UserManagementModal';
import PublishFileModal from '../components/modals/PublishFileModal';
import CreateShareLinkModal from '../components/modals/CreateShareLinkModal';
import VideoInfoModal from '../components/modals/VideoInfoModal';

const ModalContext = createContext(null);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within ModalProvider');
  }
  return context;
};

export const ModalProvider = ({ children }) => {
  const [modalState, setModalState] = useState({
    type: null, // 'input' | 'confirm' | 'video' | 'audio' | 'userManagement' | 'publishFile' | 'createShareLink' | 'videoInfo'
    config: null,
    file: null,
    playlist: null,
    currentIndex: 0,
    resolve: null,
    reject: null,
  });

  const closeModal = useCallback(() => {
    if (modalState.reject) {
      modalState.reject();
    }
    setModalState({
      type: null,
      config: null,
      file: null,
      playlist: null,
      currentIndex: 0,
      resolve: null,
      reject: null,
    });
  }, [modalState]);

  const showInputModal = useCallback((config) => {
    return new Promise((resolve, reject) => {
      setModalState({
        type: 'input',
        config,
        file: null,
        resolve,
        reject,
      });
    });
  }, []);

  const showConfirmModal = useCallback((config) => {
    return new Promise((resolve, reject) => {
      setModalState({
        type: 'confirm',
        config,
        file: null,
        resolve,
        reject,
      });
    });
  }, []);

  const showVideoPlayer = useCallback((file, playlist = null, currentIndex = 0) => {
    setModalState({
      type: file.file_type === 'audio' ? 'audio' : 'video',
      config: null,
      file,
      playlist,
      currentIndex,
      resolve: null,
      reject: null,
    });
  }, []);

  const openModal = useCallback((type, config = {}) => {
    setModalState({
      type,
      config,
      file: config.file || null,
      playlist: null,
      currentIndex: 0,
      resolve: null,
      reject: null,
    });
  }, []);

  const handleInputConfirm = useCallback((value) => {
    if (modalState.resolve) {
      modalState.resolve(value);
    }
    setModalState({
      type: null,
      config: null,
      file: null,
      playlist: null,
      currentIndex: 0,
      resolve: null,
      reject: null,
    });
  }, [modalState]);

  const handleConfirmConfirm = useCallback(() => {
    if (modalState.resolve) {
      modalState.resolve(true);
    }
    setModalState({
      type: null,
      config: null,
      file: null,
      playlist: null,
      currentIndex: 0,
      resolve: null,
      reject: null,
    });
  }, [modalState]);

  const value = {
    modalState,
    showInputModal,
    showConfirmModal,
    showVideoPlayer,
    openModal,
    closeModal,
    setModalState,
  };

  return (
    <ModalContext.Provider value={value}>
      {children}
      {/* Render modals */}
      {modalState.type === 'input' && modalState.config && (
        <InputModal
          isOpen={true}
          {...modalState.config}
          onConfirm={handleInputConfirm}
          onCancel={closeModal}
        />
      )}
      {modalState.type === 'confirm' && modalState.config && (
        <ConfirmModal
          isOpen={true}
          {...modalState.config}
          onConfirm={handleConfirmConfirm}
          onCancel={closeModal}
        />
      )}
      {(modalState.type === 'video' || modalState.type === 'audio') && modalState.file && (
        <VideoPlayerModal
          isOpen={true}
          file={modalState.file}
          playlist={modalState.playlist}
          currentIndex={modalState.currentIndex}
          onClose={closeModal}
          setModalState={setModalState}
        />
      )}
      {modalState.type === 'userManagement' && (
        <UserManagementModal
          isOpen={true}
          onClose={closeModal}
        />
      )}
      {modalState.type === 'publishFile' && modalState.file && (
        <PublishFileModal
          isOpen={true}
          file={modalState.file}
          onClose={closeModal}
          onPublished={modalState.config?.onPublished}
        />
      )}
      {modalState.type === 'createShareLink' && modalState.file && (
        <CreateShareLinkModal
          isOpen={true}
          file={modalState.file}
          currentUser={modalState.config?.currentUser}
          onClose={closeModal}
        />
      )}
      {modalState.type === 'videoInfo' && modalState.file && (
        <VideoInfoModal
          file={modalState.file}
          onClose={closeModal}
        />
      )}
    </ModalContext.Provider>
  );
};
