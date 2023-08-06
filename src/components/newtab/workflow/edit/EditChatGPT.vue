<template>
  <div>
    <ui-textarea
      :model-value="data.description"
      :placeholder="t('common.description')"
      class="w-full"
      @change="updateData({ description: $event })"
    />
    <edit-autocomplete class="mt-2">
      <label for="openai-key" class="input-label">
        {{ t('workflow.blocks.chatgpt.openaikey') }}
      </label>
      <ui-textarea
        id="openai-key"
        :model-value="data.openaikey"
        rows="3"
        class="w-full"
        autocomplete="off"
        placeholder="azertyu1234567"
        @change="updateApiKey($event)"
      />
    </edit-autocomplete>
    <ui-select
      v-if="models.length"
      :model-value="data.openaimodel"
      class="shrink-0"
      @change="updateData({ openaimodel: $event })"
    >
      <option v-for="model in models" :key="model" :value="model">
        {{ model }}
      </option>
    </ui-select>
    <edit-autocomplete class="mt-2">
      <label for="openai-prompt" class="input-label">
        {{ t('workflow.blocks.chatgpt.openaiprompt') }}
      </label>
      <ui-textarea
        id="openai-prompt"
        :model-value="data.openaiprompt"
        rows="10"
        class="w-full"
        autocomplete="off"
        placeholder="Dear ChatGPT, can you please ..."
        @change="updateData({ openaiprompt: $event })"
      />
    </edit-autocomplete>
    <hr />
    <insert-workflow-data
      :data="data"
      variables
      extra-row
      @update="updateData"
    />
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Configuration, OpenAIApi } from 'openai';
import InsertWorkflowData from './InsertWorkflowData.vue';
import EditAutocomplete from './EditAutocomplete.vue';

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
});
const emit = defineEmits(['update:data']);
const models = ref([]);

const { t } = useI18n();

async function getModels(apiKey) {
  try {
    const configuration = new Configuration({
      apiKey,
    });
    const openai = new OpenAIApi(configuration);
    const response = await openai.listModels();

    try {
      JSON.stringify(response.data);
      models.value = response.data.data.map((item) => item.id);
    } catch (error) {
      models.value = [];
    }
  } catch (error) {
    models.value = [];
  }
}

onMounted(() => {
  getModels(props.data.openaikey);
});

function updateData(value) {
  emit('update:data', { ...props.data, ...value });
}

function updateApiKey(apiKey) {
  updateData({ openaikey: apiKey });
  if (apiKey) {
    getModels(apiKey).then((fetchedModels) => {
      models.value = fetchedModels;
    });
  } else {
    models.value = [];
  }
}
</script>
