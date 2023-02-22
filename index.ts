import dotenv from "dotenv"
import axios from "axios"

const config = {
    RUNTIME_URL: "http://localhost:8080",
    BACKEND_URL: "http://localhost:3000",
}

class Group {
    name: string
    subgroups: Set<Group>

    constructor(name: string, subgroups: Set<Group> = new Set()) {
        this.name = name
        this.subgroups = subgroups
    }
}

class EntityGroup {
    group: Group
    players: Map<string, Set<string>> = new Map()

    constructor(group: Group, players: Map<string, Set<string>>) {
        this.group = group
        this.players = players
    }
}

const agent = "https://example.com/web-ide#me"
const workspace = "102"

export const deployOrganization = async (name: string, organization: Array<EntityGroup>) => {
    await createOrganizationArtifact(name)
    await Promise.all(organization.map(group => createGroupArtifact(group.group.name, name)))
    await Promise.all(Array.from(subgroupsMap(organization).entries()).flatMap(([parent, subgroups]) =>
        subgroups.map(subgroup => addSubgroup(parent, subgroup))
    ))
    await Promise.all(organization
        .flatMap(group => Array.from(group.players.entries())
            .flatMap(([role, players]) => Array.from(players)
                .map(player => tellAgent(player, group.group.name, role)))))
    await createSchemeArtifact(name)
    setTimeout(async () => {
        await addSchemeToGroup(organization[0]?.group?.name ?? "")
        await axios.post(`${config.RUNTIME_URL}/workspaces/${workspace}/artifacts/${name}/createNormativeBoard`,
            ["normativeboard"], genericRequestConfig)
    }, 5000)
}

const createOrganizationArtifact = async (organization: string) => {
    await axios.post(`${config.RUNTIME_URL}/workspaces/${workspace}/artifacts/`, {
        "artifactClass": "http://example.org/OrgBoard",
        "artifactName": organization,
        "initParams": [`${config.BACKEND_URL}/specifications/${organization}`]
    }, genericRequestConfig)
}

const createGroupArtifact = async (group: string, organization: string) =>
    await axios.post(`${config.RUNTIME_URL}/workspaces/${workspace}/artifacts/${organization}/createGroup`,
    [group.toLowerCase(), group], genericRequestConfig)

const addSubgroup = async (parent: string, subgroup: string) =>
    await axios.post(`${config.RUNTIME_URL}/workspaces/${workspace}/artifacts/${subgroup.toLowerCase()}/setParentGroup`,
    [parent.toLowerCase()], genericRequestConfig)

const tellAgent = async (agent: string, group: string, role: string) =>
    await axios.post(`${config.RUNTIME_URL}/agents/${agent}/message`,
    {
        "groupId": group.toLowerCase(),
        "role": "role_" + role,
        "group": config.RUNTIME_URL + "/workspaces/" + workspace + "/artifacts/" + group.toLowerCase(),
        "agentId": config.RUNTIME_URL + "/agents/" + agent,
        "group2Id": "farmgroup",
        "group2": config.RUNTIME_URL + "/workspaces/" + workspace + "/artifacts/farmgroup"
    }, genericRequestConfig)

const createSchemeArtifact = async (organization: string) =>
    await axios.post(`${config.RUNTIME_URL}/workspaces/${workspace}/artifacts/${organization}/createScheme`,
    ["orgscheme", "orgScheme"], genericRequestConfig)

const addSchemeToGroup = async (group: string) =>
    await axios.post(`${config.RUNTIME_URL}/workspaces/${workspace}/artifacts/${group.toLowerCase()}/addScheme`,
    ["orgscheme"], genericRequestConfig)

const subgroupsMap: (groups: Array<EntityGroup>) => Map<string, Array<string>> = groups => {
    const map = new Map<string, Array<string>>()
    groups.forEach(group => {
        if (group.group.subgroups.size > 0) {
            map.set(group.group.name, Array.from(group.group.subgroups)
                .map(subgroup => subgroup.name)
                .filter(name => groups.map(group => group.group.name).includes(name)))
        }
    })
    return map
}

const genericRequestConfig = {
    headers: {
        "X-Agent-WebID": agent,
        "Content-Type": "application/json"
    }
}

const adoptRolePlan =
    "+message(M, T) <-\n" +
    `.my_name(Name);` +
    `.print("My name is: ", Name);` +
    `.map.get(T, "group", G);\n` +
    `.map.get(T, "role", R);\n` +
    `.map.get(T, "groupId", GID);\n` +
    `.map.get(T, "agentId", A);\n` +
    `.map.get(T, "group2", GG);\n` +
    `.map.get(T, "group2Id", GGID);\n` +
    `invokeAction(G, "adoptRole", [R], Result);` +
    `.map.create(BodyMap);` +
    `.map.put(BodyMap, "artifactName", GID);` +
    `.map.put(BodyMap, "artifactIri", G);` +
    `.map.put(BodyMap, "callbackIri", A);` +
    `getTermAsJson(BodyMap, Body);` +
    `invokeAction("http://localhost:8080/workspaces/102", "focus", Body, Response);` +
    `.map.create(BodyMap2);` +
    `.map.put(BodyMap2, "artifactName", GGID);` +
    `.map.put(BodyMap2, "artifactIri", GG);` +
    `.map.put(BodyMap2, "callbackIri", A);` +
    `getTermAsJson(BodyMap2, Body2);` +
    `invokeAction("http://localhost:8080/workspaces/102", "focus", Body2, Response);` +
    `.wait(10000);` +
    `.map.create(BodyMap3);` +
    `.map.put(BodyMap3, "artifactName", "orgscheme");` +
    `.map.put(BodyMap3, "artifactIri", "http://localhost:8080/workspaces/102/artifacts/orgscheme");` +
    `.map.put(BodyMap3, "callbackIri", A);` +
    `getTermAsJson(BodyMap3, Body3);` +
    `invokeAction("http://localhost:8080/workspaces/102", "focus", Body3, Response);` +
    `.map.create(BodyMap4);` +
    `.concat(GID,".orgscheme",N);` +
    `.map.put(BodyMap4, "artifactName", N);` +
    `.concat("http://localhost:8080/workspaces/102/artifacts/",GID,NN);` +
    `.concat(NN,".orgscheme",N2);` +
    `.map.put(BodyMap4, "artifactIri", N2);` +
    `.map.put(BodyMap4, "callbackIri", A);` +
    `getTermAsJson(BodyMap4, Body4);` +
    `invokeAction("http://localhost:8080/workspaces/102", "focus", Body4, Response).`

const role =
    `+play(Agent, Role, Group) <-\n` +
    `.println("Agent ", Agent, " adopted role ", Role, " in group ", Group).`

const orgPlans =
	`+obligation(Ag,Norm,committed(Ag,Mission,Scheme),Deadline)
		: .my_name(AgentName) & .concat("http://localhost:8080/agents/", AgentName, Ag)
	   <- .print("I am obliged to commit to ",Mission," on ",Scheme,"... doing so");
	   	  invokeAction("http://localhost:8080/workspaces/102/artifacts/orgscheme", "commitMission", [Mission], Response);
          .print("response for obligation: ", Response).\n\n` +
    `{ include("$jacamoJar/templates/org-obedient.asl") }\n`

const agentsPlans = [
    // Agent 0
    `+!goal_EliminateMoths <-\n` +
    `.print("Eliminating moths...").\n\n` +
    `+!goal_EliminateBugs <-\n` +
    `.print("Eliminating bugs...").\n\n` +
    `+!goal_SprayPesticides <-\n` +
    `.print("Spraying pesticides...").\n\n`,

    // Agent 1
    `+!goal_CollectEggs <-\n` +
    `.print("Collecting eggs...").\n\n`,

    // Agent 2
    `+!goal_CollectMilk <-\n` +
    `.print("Collecting milk...").\n\n`,

    // Agent 3
    `+!goal_FeedAnimals <-\n` +
    `.print("Feeding animals...").\n\n`,

    // Agent 4
    `+!goal_Harvest <-\n` +
    `.print("Harvesting...").\n\n`,

    // Agent 5
    `+!goal_HealthCheckUp <-\n` +
    `.print("Health check up...").\n\n`,

    // Agent 6
    `+!goal_IrrigateFields <-\n` +
    `.print("Irrigating fields...").\n\n` +
    `+!goal_CalculateWaterNeeded <-\n` +
    `.print("Calculating water needed...").\n\n`,

    // Agent 7
    `+!goal_Plough <-\n` +
    `.print("Ploughing...").\n\n` +
    `+!goal_ComputeWaypoints <-\n` +
    `.print("Computing waypoints...").\n\n`,

    // Agent 8
    `+!goal_CheckHumidity <-\n` +
    `.print("Checking humidity...").\n\n`,
]


const deployAgent = async (name, body) =>
    await axios.post("http://localhost:8080//agents/", body, {
        headers: {
            "X-Agent-WebID": "http://example.org/" + name,
            "X-Agent-Name": name,
            "Content-Type": "text/plain",
        },
    })

const createWorkspace = async () =>
    await axios.post("http://localhost:8080/workspaces/", {}, {
        headers: {
            "X-Agent-WebID": agent,
            "Slug": "102",
        },
    })

const organizationName = "smart-farming"
const fieldPlayers = new Map<string, Set<string>>()
fieldPlayers.set("SoilPlower", new Set(["agent7"]))
fieldPlayers.set("Harvester", new Set(["agent4"]))
fieldPlayers.set("Irrigator", new Set(["agent6"]))
fieldPlayers.set("HumidityChecker", new Set(["agent8"]))
fieldPlayers.set("PestController", new Set(["agent0"]))
const animalPlayers = new Map<string, Set<string>>()
animalPlayers.set("Feeder", new Set(["agent3"]))
animalPlayers.set("Vet", new Set(["agent5"]))
animalPlayers.set("EggCollector", new Set(["agent1"]))
animalPlayers.set("MilkCollector", new Set(["agent2"]))
const entity: Array<EntityGroup> = [
    new EntityGroup(new Group("FarmGroup", new Set([new Group("FieldGroup"), new Group("AnimalsGroup")])), new Map<string, Set<string>>()),
    new EntityGroup(new Group("FieldGroup"), fieldPlayers),
    new EntityGroup(new Group("AnimalsGroup"), animalPlayers),
]

const main = async () => {
    await createWorkspace()
    for (let i = 0; i < agentsPlans.length; i++) {
        await deployAgent(`agent${i}`, agentsPlans[i] + "\n\n" + adoptRolePlan + "\n\n" + role + "\n\n" + orgPlans)
    }
    for (let i = 0; i < agentsPlans.length; i++) {
        await axios.put("http://localhost:8080/workspaces/102/join", {}, {
            headers: {
                "X-Agent-WebID": `http://localhost:8080/agents/agent${i}`,
            }
        })
    }
    await deployOrganization(organizationName, entity)
}

dotenv.config()
main()
