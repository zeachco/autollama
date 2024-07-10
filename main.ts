import { getNewChat } from "./TaskRunner.ts";
import path from "path";

const dir = path.join(__dirname, "generated");

// await getNewChat({
//   title: "Bird eye view goal",
//   name: "root",
//   prompt: `
//   Please help me with the following:
//   - Figure out what system is running this code
//   - What is the current working directory
//   - What is 2 + 0.4
//   - Read the repository located at ${dir}
//   - Read the content of the files and fix comments with \`// TODO:\`
//   - You can add or change code to the file using sub tasks
//   `,
// });

// await getNewChat({
//   title: "Bird eye view easy test",
//   outputType: "refine",
//   taskAiPrompt: `Help me make the sum, avg, min, max of all my financial transactions in ${dir}/transactions.csv, place the results into a readme.md file in ${dir}`,
// });

await getNewChat({
  title: "Bird eye view easy test",
  outputType: "refine",
  taskAiPrompt: `
  Please help me with the following:
  - Figure out what system is running this code
  - What is the current working directory
  - What is 2 + 0.4
  - Read the repository located at ${dir}
  - Read the content of the files and fix comments with \`// TODO:\`
  - You can add or change code to the file using sub tasks
  `,
});
