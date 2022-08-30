import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import Hubspot from 'hubspot';

const EXTENSION_TIMEOUT = 10000;

interface ICreateEngagementConfigParams {
	engagementType: string;
	owner: string;
	taskBody: string;
	taskSubject: string;
	taskStatus: string;
	taskAssociatedContact: string;
	connection: {
		accessToken: string;
	};
	storeLocation: string;
	contextKey: string;
	inputKey: string;
}

export interface ICreateEngagement extends INodeFunctionBaseParams {
	config: ICreateEngagementConfigParams;
}

export const createEngagementNode = createNodeDescriptor({
	type: "createEngagement",
	defaultLabel: "Create Engagement",
	fields: [
		{
			key: "connection",
			label: "The Hubspot connection which should be used.",
			type: "connection",
			params: {
				required: true,
				connectionType: "hubspot"
			}
		},
		{
			key: "engagementType",
			type: "select",
			label: "Type",
			defaultValue: "input",
			params: {
				options: [
					{
						label: "Task",
						value: "TASK"
					}
				],
				required: true
			},
		},
		{
			key: "owner",
			label: "Engagement Owner ID",
			description: "Hubspot VID of the Engagement Owner",
			type: "cognigyText",
			params: {
				required: true
			}
		},
		{
			key: "taskBody",
			label: "Task Body",
			type: "cognigyText",
			params: {
				multiline: true,
				rows: 3
			}
		},
		{
			key: "taskSubject",
			label: "Task Subject",
			type: "cognigyText",
			params: {
				required: true
			}
		},
		{
			key: "taskStatus",
			type: "select",
			label: "Task Status",
			defaultValue: "NOT_STARTED",
			params: {
				options: [
					{
						label: "NOT_STARTED",
						value: "NOT_STARTED"
					},
					{
						label: "COMPLETED",
						value: "COMPLETED"
					}
				],
				required: true
			},
		},
		{
			key: "taskAssociatedContact",
			label: "Associated Contact ID",
			type: "cognigyText",
			params: {
				required: true
			}
		},
		{
			key: "storeLocation",
			type: "select",
			label: "Where to store the result",
			defaultValue: "input",
			params: {
				options: [
					{
						label: "Input",
						value: "input"
					},
					{
						label: "Context",
						value: "context"
					}
				],
				required: true
			},
		},
		{
			key: "inputKey",
			type: "cognigyText",
			label: "Input Key to store Result",
			defaultValue: "hubspot",
			condition: {
				key: "storeLocation",
				value: "input",
			}
		},
		{
			key: "contextKey",
			type: "cognigyText",
			label: "Context Key to store Result",
			defaultValue: "hubspot",
			condition: {
				key: "storeLocation",
				value: "context",
			}
		},
	],
	sections: [
		{
			key: "storage",
			label: "Storage Option",
			defaultCollapsed: true,
			fields: [
				"storeLocation",
				"inputKey",
				"contextKey",
			]
		},
		{
			key: "advanced",
			label: "Text Fields",
			defaultCollapsed: true,
			fields: [
				"fields",
				"properties"
			]
		}
	],
	form: [
		{ type: "field", key: "connection" },
		{ type: "field", key: "engagementType" },
		{ type: "field", key: "owner" },
		{ type: "field", key: "taskSubject" },
		{ type: "field", key: "taskBody" },
		{ type: "field", key: "taskStatus" },
		{ type: "field", key: "taskAssociatedContact" },
		{ type: "section", key: "storage" },
		{ type: "section", key: "advanced" },
	],
	preview: {
		type: "text",
		key: "taskSubject"
	},
	appearance: {
		color: "#fa7820"
	},

	function: async ({ cognigy, config }: ICreateEngagement) => {
		const { api } = cognigy;
		const {
			storeLocation,
			contextKey,
			inputKey,
			taskAssociatedContact,
			taskStatus,
			taskSubject,
			taskBody,
			owner,
			engagementType,
			connection
		} = config;
		const { accessToken } = connection;

		try {
			if (storeLocation === "context") api.deleteContext(contextKey);

			const result = await Promise.race([
				createEngagement(config, accessToken),
				new Promise((resolve, reject) => setTimeout(() => resolve({ "error": "timeout" }), EXTENSION_TIMEOUT))
			]);

			if (storeLocation === "context") api.addToContext(contextKey, result, "simple");
			// @ts-ignore
			else api.addToInput(inputKey, result);

		} catch (err) {
			const resultObject = {
				result: null,
				error: err.message
			};
			if (storeLocation === "context") {
				api.addToContext(contextKey, resultObject, "simple");
			} else {
				// @ts-ignore
				api.addToInput(inputKey, resultObject);
			}
		}
	}
});

/**
 * Create an Engagement in Hubspot
 * @param config The Engagement Config
 */
async function createEngagement(config: ICreateEngagementConfigParams, accessToken: string): Promise<any> {
	try {
		const hubspot = new Hubspot({ accessToken });
		// @ts-ignore
		if (hubspot.qs && typeof hubspot.qs === 'object') hubspot.qs.propertyMode = 'value_only';

		try {
			const response = await hubspot.engagements.create(
				{
				  "engagement": {
					  "active": true,
					  "ownerId": config.owner,
					  "type": config.engagementType,
					  "timestamp": new Date().getTime()
				  },
				  "associations": {
					  "contactIds": [config.taskAssociatedContact],
					  "companyIds": [ ],
					  "dealIds": [ ],
					  "ownerIds": [ ],
					  "ticketIds": [ ],
				  },
				  "metadata": {
					  "body": config.taskBody,
					  "subject": config.taskSubject,
					  "status": config.taskStatus,
					  "forObjectType": "CONTACT"
				  }
			  });

			const engagement = response.engagement;

			return engagement ? response : null;

		} catch (err) {
			return {
				error: err.message
			};
		}

	} catch (err) {
		throw new Error(err.message);
	}
}
