import { Ollama } from "ollama-node";
import { streamToFile } from "./utilities";
import $ from "bun";

function write(data: string) {
  globalThis.process?.stdout.write(new TextEncoder().encode(data));
}

type Model = "llama3" | "tinyllama" | "codellama" | "mistral" | "gemma2";
type OutputType = "shellCode" | "tsCode" | "textString" | "refine";

type Answer =
  | {
      answerType: "shellCode" | "tsCode" | "textString";
      content: string; // The code or text to be executed or displayed
    }
  | {
      answerType: "refine";
      content: Task[];
    };

interface Task {
  title: string;
  taskAiPrompt: string;
  model: Model;
  outputType: OutputType;
}

const defaultTask: Task = {
  outputType: "refine",
  title: "[title]",
  taskAiPrompt: "Warn the user that he forgot to enter a prompt on getNewChat",
  model: "llama3",
};

export async function getNewChat(options: Partial<Task>) {
  const currentTask = { ...defaultTask, ...options };
  const model = new Ollama();
  // model.addParameter("outputType", task.outputType);
  // model.addParameter("outputExample", task.outputExample);
  // model.addParameter("aiType", task.type);
  // model.addParameter("taskTitle", task.title);

  await model.setModel(currentTask.model);
  // await model.setTemplate(template);

  const tasks: Task[] = [currentTask];
  let lastError: Error | undefined;
  while (tasks.length) {
    write(
      tasks
        .map(
          (t) =>
            `[${currentTask.model}/${currentTask.title}]\n ${
              currentTask.outputType
            }: ${currentTask.taskAiPrompt.substring(40)}`
        )
        .join("\n")
    );

    const [nextTask] = tasks.splice(0, 1);
    if (!nextTask) return;
    let request = `RULES\n${getDefaultSystemPrompt()}\n\n`;
    request += `ROLE:\n${currentTask.outputType}\n\n`;
    request += `USER:\n${currentTask.taskAiPrompt}\n\n`;
    if (lastError) request += `SYSTEM_ERROR:\n${lastError}\n\n`;
    request += `RESPONSE:\n`;

    console.log(request);
    let output: string = await stream(model, request, currentTask);

    let out: Answer;
    try {
      out = JSON.parse(output.trim()) as Answer;
    } catch (err) {
      console.log(`Failed to parse JSON`, err);
      console.dir(output);
      return;
    }
    try {
      switch (out.answerType) {
        case "shellCode":
        case "tsCode":
        case "textString":
          await executeScript(out.content, currentTask.title);
          break;
        case "refine":
          console.log(`Adding ${out.content.length} tasks to the queue`);
          tasks.push(...out.content);
          break;
      }
    } catch (error) {
      tasks.push({
        model: "codellama",
        outputType: "textString",
        title: nextTask.title,
        taskAiPrompt: `Error: ${error} on code ${out.content}`,
      });
      return output;
    }
  }
  // }
  // write(output);
  debugger;
  return { model, task: currentTask };
}

async function executeScript(script: string, name: string) {
  const scriptFile = `./generated/_${name}.ts`;
  const writter = streamToFile(scriptFile);
  writter(script);
  const { run } = await import(scriptFile);
  const runResult = await run();
  return runResult;
}

// function getDefaultTemplate(outputType: OutputType = "javascript") {
//   if (outputType === "tasks") {
//     return `
// interface Task {
//   title: string;
//   name: string;
//   prompt: string;
// }

// export async run(): Promise<Task[]> {
//   // Execute the code of this current task
//   return [
//     //... array of tasks if any, might be empty
//   ];
// }
// `;
//   }
// }

function stream(model: Ollama, prompt: string, task: Task): Promise<string> {
  return new Promise((resolve) => {
    let content = "";
    // const writter = streamToFile(`./generated/${task.name}.ts`);
    model.streamingGenerate(
      prompt,
      (text) => {
        content += text;
        write(text);
        // await writter(text)
      },
      () => {},
      (status) => {
        const stats = JSON.parse(status);
        if (stats.done || stats.done_reason) {
          resolve(content);
        }
      }
    );
  });
}

// export class TaskRunner {
//   public ai = new Ollama();
//   public name = "root";
//   public type: "runner" | "analyst" | "divider" = "analyst";
//   public template = getDefaultTemplate();
//   public ready: Promise<TaskRunner>;

//   #subTasks: TaskRunner[] = [];

//   constructor(
//     public userTask: string,
//     public title = "root",
//     public model: string = "llama3",
//     public level: number = 0,
//   ) {
//     this.ready = this.setup(this);
//   }

//   async setup(Task: Partial<TaskRunner>) {
//     Object.assign(this, Task);
//     await this.ai.setModel(this.model);
//     await this.ai.setTemplate(this.template);
//     log(`[${this.type}/${this.model}] SETUP`, this.level);
//     return this;
//   }

//   async run() {
//     const task = await this.ready;
//     console.log(`[${this.type}/${this.model}] RUN`);

//     if (this.type === "runner") {
//       // await this.ai.setModel('llama3');
//       await this.ai.setTemplate(getDefaultTemplate());
//       const code = await this.stream(this.fullPrompt);
//       await this.#writeAndRunScript(code);
//       return [];
//     }

//     if (this.type === "analyst") {
//       this.model = "tinyllama";
//       // this.ai.setJSONFormat(true);
//       // await this.ai.setTemplate(`{answer: "yes"}`);
//       this.ai.setJSONFormat(true);
//       const json = await this.stream(
//         `Please define if this needs to be split into multiple tasks: ${
//           JSON.stringify(
//             this.userTask,
//           )
//         }\n\n Just answer with "yes" or "no" in an object like "{answer: "yes"}"`,
//       );
//       const { answer } = JSON.parse(json);
//       if (answer.toLowerCase().trim() === "yes") {
//         const title = `dividing_${this.title}`;
//         const userTasks =
//           `Divide the user request into Tasks where Task are \`({taskType:'analyst'|'runner'|'divider', taskTitle:string, fullPrompt:string, ollamaModel:string})[]\`.\n\nUser request:\n${this.userTask}`;
//         const divider = new TaskRunner(
//           userTasks,
//           title,
//           "llama3",
//           this.level + 1,
//         );
//         divider.type = "divider";
//         await divider.ai.setModel(this.model);
//         divider.ai.setJSONFormat(true);
//         const tasksText = await divider.stream(userTasks);
//         const { tasks } = JSON.parse(tasksText);
//         return Promise.all(
//           tasks.map(
//             (task: {
//               taskType: string;
//               taskTitle: string;
//               fullPrompt: string;
//             }) => {
//               const runner = new TaskRunner(
//                 task.fullPrompt,
//                 task.taskTitle,
//                 "llama3",
//                 this.level + 1,
//               );
//               runner.type = task.taskType as "runner" | "analyst" | "divider";
//               return runner.run();
//             },
//           ),
//         );
//       }
//       return [];
//     }
//   }

//   async #writeAndRunScript(script: string) {
//     const scriptFile = `generated/_${this.name}.ts`;
//     await Deno.writeTextFile(scriptFile, script);
//     const { run } = await import(scriptFile);

//     console.log({ run });
//     const runResult = await run();
//     console.log({ runResult });
//     debugger;

//     // return Deno.run({
//     //   cmd: [
//     //     "deno",
//     //     "run",
//     //     "--allow-net",
//     //     "--allow-read",
//     //     "--allow-write",
//     //     scriptFile,
//     //   ],
//     // });
//   }

//   async stream(task: string): Promise<string> {
//     console.info(`[${this.type}/${this.model}] : ${task}`);
//     // const { output } = await this.ai.generate(task);
//     // // tree(output, this.level);
//     // return output;
//     return new Promise((resolve) => {
//       let content = "";
//       this.ai.streamingGenerate(
//         task,
//         (text) => {
//           content += text;
//           write(text);
//         },
//         () => {},
//         (status) => {
//           const stats = JSON.parse(status);
//           if (stats.done || stats.done_reason) {
//             resolve(content);
//           }
//         },
//       );
//     });
//   }

//   get fullPrompt() {
//     return `${getDefaultSystemPrompt()}\n\nUser: ${this.userTask}\n\nHere is the code:\n`;
//   }
// }

function getDefaultSystemPrompt() {
  return [
    "You are an endpoint API that will generate code based on the user request",
    `You can only answer with JSON matching this Answer TS type:
interface Answer {
  /**
   * shellCode is mean to be executed in a shell
   * tsCode is meant to be executed in a typescript file
   * textString is meant to be displayed to the user (considered as a javascript string)
   * refine is an array of tasks that need to be refined before advancing
   */
  answerType: "shellCode"|"tsCode"|"textString'|'refine', // defines the type of tasks
  content: string // The code or text to be executed or displayed
}

If answerType is refine, the content should be an array of tasks that need to be refined before advancing, here is a task interface:

type Model = "llama3" | "tinyllama" | "codellama" | "mistral" | "gemma2";
type OutputType = "shellCode" | "tsCode" | "textString" | "refine";
interface Task {
  type: "shellCode" | "tsCode" | "textString" | "refine";
  title: string;
  taskAiPrompt: string;
  model: Model;
  outputType: OutputType;
  outputExample: string;
}
`,
    "You choose the best answerType based on the user request",
    "If you pick shellCode, the `content` should be a string that can be executed in a shell",
    "If you pick tsCode, the content `should` be a string that can be executed in a typescript file with bun.js",
    "If you pick textString, the `content` should be a string that can be displayed to the user",
    "If you pick refine, the `content` should be an array or tasks that need to be refined before advanceing",
    "Keep answer short and to the point",
    "Do not include any explanations, comments, or non-code text in your response",
    "If you cannot generate code to match the prompt exactly, do not respond at all",
    "Avoid placeholder comments, even if it seems trivial",
    "Do not include example usage of the code, only the final code itself",
    "If you need token or secret to access a service, create a sub task that will wait for a .env to contain the necessary keys",
    `Now, please answer the following prompt.`,
  ]
    .map((rule, index) => `#${index + 1} ${rule}`)
    .join(".\n");
}
