<template>
  <div class="max-w-xl">
    <ui-card class="mb-12">
      <h2 class="mb-2 font-semibold">
        {{ t('settings.backupWorkflows.cloud.title') }}
      </h2>
      <template v-if="userStore.user">
        <div
          class="flex items-center rounded-lg border p-4 dark:border-gray-700"
        >
          <span class="bg-box-transparent inline-block rounded-full p-2">
            <v-remixicon name="riUploadLine" />
          </span>
          <div class="ml-4 flex-1 leading-tight">
            <p class="text-sm text-gray-600 dark:text-gray-200">
              {{ t('settings.backupWorkflows.cloud.lastBackup') }}
            </p>
            <p>{{ formatDate(state.lastBackup) }}</p>
          </div>
          <ui-button
            :loading="backupState.loading"
            @click="backupState.modal = true"
          >
            {{ t('settings.backupWorkflows.backup.button') }}
          </ui-button>
        </div>
        <div
          class="mt-2 flex items-center rounded-lg border p-4 dark:border-gray-700"
        >
          <span class="bg-box-transparent inline-block rounded-full p-2">
            <v-remixicon name="riDownloadLine" />
          </span>
          <p class="ml-4 flex-1">
            {{ t('settings.backupWorkflows.cloud.sync') }}
          </p>
          <ui-button
            :loading="state.loadingSync"
            class="ml-2"
            @click="syncBackupWorkflows"
          >
            {{ t('settings.backupWorkflows.cloud.sync') }}
          </ui-button>
        </div>
      </template>
      <div v-else class="py-4 text-center">
        <p>
          {{ t('settings.backupWorkflows.needSignin') }}
        </p>
        <ui-button
          tag="a"
          href="https://automa.site/auth"
          target="_blank"
          class="mt-4 inline-block w-44"
        >
          {{ t('auth.signIn') }}
        </ui-button>
      </div>
      <p v-if="false">
        Upgrade to the
        <a
          href="https://automa.site/pricing"
          target="_blank"
          class="text-yellow-500 underline dark:text-yellow-300"
        >
          pro plan
        </a>
        to start back up your workflows to the cloud
      </p>
    </ui-card>
    <h2 class="mb-2 font-semibold">
      {{ t('settings.backupWorkflows.title') }}
    </h2>
    <div class="flex space-x-4">
      <div class="w-6/12 rounded-lg border p-4 dark:border-gray-700">
        <div class="text-center">
          <span class="bg-box-transparent inline-block rounded-full p-4">
            <v-remixicon name="riDownloadLine" size="36" />
          </span>
        </div>
        <ui-checkbox v-model="state.encrypt" class="mt-12 mb-4">
          {{ t('settings.backupWorkflows.backup.encrypt') }}
        </ui-checkbox>
        <ui-button class="w-full" @click="backupWorkflows">
          {{ t('settings.backupWorkflows.backup.button') }}
        </ui-button>
      </div>
      <div class="w-6/12 rounded-lg border p-4 dark:border-gray-700">
        <div class="text-center">
          <span class="bg-box-transparent inline-block rounded-full p-4">
            <v-remixicon name="riUploadLine" size="36" />
          </span>
        </div>
        <ui-checkbox v-model="state.updateIfExists" class="mt-6 mb-4">
          {{ t('settings.backupWorkflows.restore.update') }}
        </ui-checkbox>
        <ui-button class="w-full" @click="restoreWorkflows">
          {{ t('settings.backupWorkflows.restore.button') }}
        </ui-button>
      </div>
    </div>
  </div>
  <ui-modal
    v-model="backupState.modal"
    :title="t('settings.backupWorkflows.cloud.title')"
    content-class="max-w-5xl"
  >
    <settings-cloud-backup
      v-model:ids="backupState.ids"
      @close="backupState.modal = false"
    />
  </ui-modal>
</template>
<script setup>
import { reactive, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'vue-toastification';
import dayjs from 'dayjs';
import AES from 'crypto-js/aes';
import encUtf8 from 'crypto-js/enc-utf8';
import browser from 'webextension-polyfill';
import hmacSHA256 from 'crypto-js/hmac-sha256';
import { useDialog } from '@/composable/dialog';
import { useUserStore } from '@/stores/user';
import { getUserWorkflows } from '@/utils/api';
import { useWorkflowStore } from '@/stores/workflow';
import { fileSaver, openFilePicker, parseJSON } from '@/utils/helper';
import SettingsCloudBackup from '@/components/newtab/settings/SettingsCloudBackup.vue';

const { t } = useI18n();
const toast = useToast();
const dialog = useDialog();
const userStore = useUserStore();
const workflowStore = useWorkflowStore();

const state = reactive({
  lastSync: null,
  encrypt: false,
  lastBackup: null,
  loadingSync: false,
  updateIfExists: false,
});
const backupState = reactive({
  ids: [],
  modal: false,
  loading: false,
});

function formatDate(date) {
  if (!date) return 'null';

  return dayjs(date).format('DD MMMM YYYY, hh:mm A');
}
async function syncBackupWorkflows() {
  try {
    state.loadingSync = true;
    const { backup, hosted } = await getUserWorkflows(false);
    const backupIds = backup.map(({ id }) => id);

    userStore.backupIds = backupIds;
    userStore.hostedWorkflows = hosted;

    await browser.storage.local.set({
      backupIds,
      lastBackup: new Date().toISOString(),
    });

    await workflowStore.insertOrUpdate(backup, { checkUpdateDate: true });

    state.loadingSync = false;
  } catch (error) {
    console.error(error);
    toast.error(t('message.somethingWrong'));
    state.loadingSync = false;
  }
}
function backupWorkflows() {
  const workflows = workflowStore.getWorkflows.reduce((acc, workflow) => {
    if (workflow.isProtected) return acc;

    delete workflow.$id;
    delete workflow.createdAt;
    delete workflow.data;
    delete workflow.isDisabled;
    delete workflow.isProtected;

    acc.push(workflow);

    return acc;
  }, []);
  const payload = {
    isProtected: state.encrypt,
    workflows: JSON.stringify(workflows),
  };
  const downloadFile = (data) => {
    const fileName = `automa-${dayjs().format('DD-MM-YYYY')}.json`;
    const blob = new Blob([JSON.stringify(data)], {
      type: 'application/json',
    });
    const objectUrl = URL.createObjectURL(blob);

    fileSaver(fileName, objectUrl);

    URL.revokeObjectURL(objectUrl);
  };

  if (state.encrypt) {
    dialog.prompt({
      placeholder: t('common.password'),
      title: t('settings.backupWorkflows.title'),
      okText: t('settings.backupWorkflows.backup.button'),
      inputType: 'password',
      onConfirm: (password) => {
        const encryptedWorkflows = AES.encrypt(
          payload.workflows,
          password
        ).toString();
        const hmac = hmacSHA256(encryptedWorkflows, password).toString();

        payload.workflows = hmac + encryptedWorkflows;

        downloadFile(payload);
      },
    });
  } else {
    downloadFile(payload);
  }
}
async function restoreWorkflows() {
  try {
    const [file] = await openFilePicker('application/json');
    const reader = new FileReader();
    const insertWorkflows = (workflows) => {
      const newWorkflows = workflows.map((workflow) => {
        if (!state.updateIfExists) {
          workflow.createdAt = Date.now();
          delete workflow.id;
        }

        return workflow;
      });
      const showMessage = (event) => {
        toast(
          t('settings.backupWorkflows.workflowsAdded', {
            count: event.workflows.length,
          })
        );
      };

      if (state.updateIfExists) {
        return workflowStore.insertOrUpdate(newWorkflows).then(showMessage);
      }

      return workflowStore.insert(newWorkflows).then(showMessage);
    };

    reader.onload = ({ target }) => {
      const payload = parseJSON(target.result, null);

      if (!payload) return;

      if (payload.isProtected) {
        dialog.prompt({
          placeholder: t('common.password'),
          title: t('settings.backupWorkflows.restore.title'),
          okText: t('settings.backupWorkflows.restore.button'),
          inputType: 'password',
          onConfirm: (password) => {
            const hmac = payload.workflows.substring(0, 64);
            const encryptedWorkflows = payload.workflows.substring(64);
            const decryptedHmac = hmacSHA256(
              encryptedWorkflows,
              password
            ).toString();

            if (hmac !== decryptedHmac) {
              toast.error(t('settings.backupWorkflows.invalidPassword'));

              return;
            }

            const decryptedWorkflows = AES.decrypt(
              encryptedWorkflows,
              password
            ).toString(encUtf8);
            payload.workflows = parseJSON(decryptedWorkflows, []);

            insertWorkflows(payload.workflows);
          },
        });
      } else {
        payload.workflows = parseJSON(payload.workflows, []);
        insertWorkflows(payload.workflows);
      }
    };

    reader.readAsText(file);
  } catch (error) {
    console.error(error);
    toast.error(error.message);
  }
}

onMounted(async () => {
  const { lastBackup, lastSync } = await browser.storage.local.get([
    'lastBackup',
    'lastSync',
  ]);

  state.lastSync = lastSync;
  state.lastBackup = lastBackup;
});
</script>
