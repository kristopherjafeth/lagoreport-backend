import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import {
  IoTDataPlaneClient,
  PublishCommand,
} from "@aws-sdk/client-iot-data-plane";

const router = Router();
const prisma = new PrismaClient();

// Configurar AWS IoT
const client = new IoTDataPlaneClient({
  endpoint: "https://a24jgdzlb8zpas-ats.iot.us-east-2.amazonaws.com",
  region: "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});


router.post("/commands", async (req, res) => {
  try {
    const { deviceId, commands, crop } = req.body;

    if (!commands || typeof commands !== 'object') {
      return res
        .status(400)
        .json({ error: "El campo 'commands' debe ser un objeto con los comandos." });
    }

    const validCommands = ["pumpIrrigation", "lamp", "fan", "heater", "fertilizerPump"];
    for (const command in commands) {
      if (!validCommands.includes(command) || (commands[command] !== "ON" && commands[command] !== "OFF")) {
        return res
          .status(400)
          .json({ error: `El comando '${command}' debe ser 'ON' u 'OFF' y debe ser uno de los siguientes: ${validCommands.join(", ")}` });
      }
    }

    const params = {
      topic: "esp32/led",
      qos: 0,
      payload: JSON.stringify({ deviceId, commands, crop }),
    };

    const publishCommand = new PublishCommand(params);
    try {
      const data = await client.send(publishCommand);
      console.log("Publicado en AWS IoT:", data);
      res.json({
        message: data,
        commands,
      });
    } catch (err) {
      console.error("Error publicando en AWS IoT:", err);
      res.status(500).json({ error: err.message });
    }
  } catch (error) {
    console.error("Error procesando la solicitud:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});



router.post("/sensors", async (req, res) => {
  const { timestamp, sensors } = req.body;
  const {  temperature, humidity, luminosity, co2, moisture, ph } = sensors;
  const greenhouseId = 1;
  console.log("sensors", sensors);
  console.log("timestamp", timestamp);

  try {
    try {
      await prisma.temperature.create({
        data: {
          value: temperature || 0,
          greenhouseId,
          timestamp: new Date(timestamp * 1000),
        },
      });

      console.log("Temperature created successfully", temperature);
    } catch (error) {
      console.error("Error creating temperature:", error);
    }


      try {
        await prisma.humidity.create({
          data: {
            value: humidity || 0,
            greenhouseId,
            timestamp: new Date(timestamp * 1000),
          },
        });

        console.log("humidity created successfully", humidity);
      } catch (error) {
        console.error("Error creating humidity:", error);
      }

    try {
      await prisma.luminosity.create({
        data: {
          value: luminosity || 0,
          greenhouseId,
          timestamp: new Date(timestamp * 1000),
        },
      });

      console.log("luminosity created successfully", luminosity);
    } catch (error) {
      console.error("Error creating luminosity:", error);
    }


    //
    // // Insert CO2

    try {
      await prisma.co2.create({
        data: {
          value: co2 || 0,
          greenhouseId,
          timestamp: new Date(timestamp * 1000),
        },
      });

      console.log("co2 created successfully", co2);
    } catch (error) {
      console.error("Error creating co2:", error);
    }



    try {
      await prisma.moi.create({
        data: {
          value: moisture || 0,
          greenhouseId,
          timestamp: new Date(timestamp * 1000),
        },
      });

      console.log("moisture created successfully", moisture);
    } catch (error) {
      console.error("Error creating moisture:", error);
    }


    //
    // Insert pH
    try {
      await prisma.ph.create({
        data: {
          value: ph || 0,
          greenhouseId,
          timestamp: new Date(timestamp * 1000),
        },
      });

      console.log("ph created successfully", ph);
    } catch (error) {
      console.error("Error creating ph:", error);
    }

    res.json("Sensors data created successfully");
  } catch (error) {
    console.error("Error creating sensors data:", error);
    res.status(500).send("Error creating sensors data");
  }
});

// Endpoints para Greenhouse
router.get("/greenhouses", async (req, res) => {
  try {
    const greenhouses = await prisma.greenhouse.findMany();
    res.json(greenhouses);
  } catch (error) {
    console.error("Error fetching greenhouses:", error);
    res.status(500).send("Error fetching greenhouses");
  }
});

router.get("/greenhouses/:id", async (req, res) => {
  try {
    const productFound = await prisma.greenhouse.findFirst({
      where: {
        id: parseInt(req.params.id),
      },
    });
    return res.json(productFound);
  } catch (error) {
    console.error("Error fetching greenhouses:", error);
    res.status(500).send("Error fetching greenhouses");
  }
});

router.post("/greenhouses", async (req, res) => {
  try {
    const { name, country, website, phone, cif, profileImage } = req.body;
    const newGreenhouse = await prisma.greenhouse.create({
      data: {
        name,
        country,
        website,
        phone,
        cif,
        profileImage,
      },
    });
    res.json(newGreenhouse);
  } catch (error) {
    console.error("Error creating a new greenhouse:", error);
    res.status(500).send("Error creating a new greenhouse");
  }
});

router.delete("/greenhouses/:id", async (req, res) => {
  try {
    const deletedProduct = await prisma.greenhouse.delete({
      where: {
        id: parseInt(req.params.id),
      },
    });
    return res.json(deletedProduct);
  } catch (error) {
    console.error("Error fetching greenhouses:", error);
    res.status(500).send("Error fetching greenhouses");
  }
});

router.put("/greenhouses/:id", async (req, res) => {
  try {
    const { name, country, website, phone, cif, profileImage } = req.body;
    const productUpdate = await prisma.greenhouse.update({
      where: {
        id: parseInt(req.params.id, 10),
      },
      data: {
        name,
        country,
        website,
        phone,
        cif,
        profileImage,
      },
    });
    return res.json(productUpdate);
  } catch (error) {
    console.error("Error fetching greenhouses:", error);
    res.status(500).send("Error fetching greenhouses");
  }
});

// Endpoints to Temperature
router.get("/temperatures", async (req, res) => {
  try {
    const temperatures = await prisma.temperature.findMany();
    console.log("temperatures", temperatures);
    res.json(temperatures);
  } catch (error) {
    console.error("Error fetching temperatures:", error);
    res.status(500).send("Error fetching temperatures");
  }
});

// Endpoint para obtener temperaturas por ID del invernadero
router.get("/temperatures/:greenhouseId", async (req, res) => {
  const { greenhouseId } = req.params;
  try {
    const temperatures = await prisma.temperature.findMany({
      where: {
        greenhouseId: parseInt(greenhouseId, 10),
      },
    });
    res.json(temperatures);
  } catch (error) {
    console.error(
      `Error fetching temperatures for greenhouseId ${greenhouseId}:`,
      error
    );
    res.status(500).send("Error fetching temperatures");
  }
});

router.post("/temperatures", async (req, res) => {
  try {
    const { temperature } = req.body;
    const greenhouseId = 1;

    const newHumidity = await prisma.temperature.create({
      data: {
        value: temperature,
        greenhouseId,
      },
    });
    res.json(newHumidity);
  } catch (error) {
    console.error("Error creating a new temperature:", error);
    res.status(500).send("Error creating a new humidity");
  }
});

router.put("/temperatures/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { value, greenhouseId } = req.body;
    const updatedTemperature = await prisma.temperature.update({
      where: { id: parseInt(id) },
      data: {
        value,
        greenhouseId,
      },
    });
    res.json(updatedTemperature);
  } catch (error) {
    console.error("Error updating temperature:", error);
    res.status(500).send("Error updating temperature");
  }
});

router.delete("/temperatures/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.temperature.delete({
      where: { id: parseInt(id) },
    });
    res.sendStatus(204);
  } catch (error) {
    console.error("Error deleting temperature:", error);
    res.status(500).send("Error deleting temperature");
  }
});

// Endpoints to Humidity
router.get("/humidities", async (req, res) => {
  try {
    const humidities = await prisma.humidity.findMany();
    res.json(humidities);
  } catch (error) {
    console.error("Error fetching humidities:", error);
    res.status(500).send("Error fetching humidities");
  }
});

// Endpoint para obtener temperaturas por ID del invernadero
router.get("/humidities/:greenhouseId", async (req, res) => {
  const { greenhouseId } = req.params;
  try {
    const humidities = await prisma.humidity.findMany({
      where: {
        greenhouseId: parseInt(greenhouseId, 10),
      },
    });
    res.json(humidities);
  } catch (error) {
    console.error(
      `Error fetching humidities for greenhouseId ${greenhouseId}:`,
      error
    );
    res.status(500).send("Error fetching humidities");
  }
});

router.post("/humidities", async (req, res) => {
  try {
    const { value, greenhouseId } = req.body;
    const newHumidity = await prisma.humidity.create({
      data: {
        value,
        greenhouseId,
      },
    });
    res.json(newHumidity);
  } catch (error) {
    console.error("Error creating a new humidity:", error);
    res.status(500).send("Error creating a new humidity");
  }
});

router.put("/humidities/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { value, greenhouseId } = req.body;
    const updatedHumidity = await prisma.humidity.update({
      where: { id: parseInt(id) },
      data: {
        value,
        greenhouseId,
      },
    });
    res.json(updatedHumidity);
  } catch (error) {
    console.error("Error updating humidity:", error);
    res.status(500).send("Error updating humidity");
  }
});

router.delete("/humidities/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.humidity.delete({
      where: { id: parseInt(id) },
    });
    res.sendStatus(204);
  } catch (error) {
    console.error("Error deleting humidity:", error);
    res.status(500).send("Error deleting humidity");
  }
});

// Endpoints to luminosity
router.get("/luminosity", async (req, res) => {
  try {
    const brightnesses = await prisma.luminosity.findMany();
    res.json(brightnesses);
  } catch (error) {
    console.error("Error fetching brightnesses:", error);
    res.status(500).send("Error fetching brightnesses");
  }
});

// Endpoint para obtener temperaturas por ID del invernadero
router.get("/luminosity/:greenhouseId", async (req, res) => {
  const { greenhouseId } = req.params;
  try {
    const luminosities = await prisma.luminosity.findMany({
      where: {
        greenhouseId: parseInt(greenhouseId, 10),
      },
    });
    res.json(luminosities);
  } catch (error) {
    console.error(
      `Error fetching luminosities for greenhouseId ${greenhouseId}:`,
      error
    );
    res.status(500).send("Error fetching luminosities");
  }
});

router.post("/luminosity", async (req, res) => {
  try {
    const { value, greenhouseId } = req.body;
    const newBrightness = await prisma.luminosity.create({
      data: {
        value,
        greenhouseId,
      },
    });
    res.json(newBrightness);
  } catch (error) {
    console.error("Error creating a new luminosity:", error);
    res.status(500).send("Error creating a new luminosity");
  }
});

router.put("/luminosity/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { value, greenhouseId } = req.body;
    const updatedBrightness = await prisma.luminosity.update({
      where: { id: parseInt(id) },
      data: {
        value,
        greenhouseId,
      },
    });
    res.json(updatedBrightness);
  } catch (error) {
    console.error("Error updating brightness:", error);
    res.status(500).send("Error updating brightness");
  }
});

router.delete("/luminosity/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.luminosity.delete({
      where: { id: parseInt(id) },
    });
    res.sendStatus(204);
  } catch (error) {
    console.error("Error deleting luminosity:", error);
    res.status(500).send("Error deleting luminosity");
  }
});

// Endpoints para SoilHumidity
router.get("/soilhumidities", async (req, res) => {
  try {
    const soilhumidities = await prisma.moi.findMany();
    res.json(soilhumidities);
  } catch (error) {
    console.error("Error fetching soil humidities:", error);
    res.status(500).send("Error fetching soil humidities");
  }
});

// Endpoint para obtener temperaturas por ID del invernadero
router.get("/soilhumidities/:greenhouseId", async (req, res) => {
  const { greenhouseId } = req.params;
  try {
    const soilhumidities = await prisma.moi.findMany({
      where: {
        greenhouseId: parseInt(greenhouseId, 10),
      },
    });
    res.json(soilhumidities);
  } catch (error) {
    console.error(
      `Error fetching luminosities for greenhouseId ${greenhouseId}:`,
      error
    );
    res.status(500).send("Error fetching luminosities");
  }
});

router.post("/soilhumidities", async (req, res) => {
  try {
    const { value, greenhouseId } = req.body;
    const newSoilHumidity = await prisma.soilHumidity.create({
      data: {
        value,
        greenhouseId,
      },
    });
    res.json(newSoilHumidity);
  } catch (error) {
    console.error("Error creating a new soil humidity:", error);
    res.status(500).send("Error creating a new soil humidity");
  }
});

router.put("/soilhumidities/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { value, greenhouseId } = req.body;
    const updatedSoilHumidity = await prisma.soilHumidity.update({
      where: { id: parseInt(id) },
      data: {
        value,
        greenhouseId,
      },
    });
    res.json(updatedSoilHumidity);
  } catch (error) {
    console.error("Error updating soil humidity:", error);
    res.status(500).send("Error updating soil humidity");
  }
});

router.delete("/soilhumidities/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.soilHumidity.delete({
      where: { id: parseInt(id) },
    });
    res.sendStatus(204);
  } catch (error) {
    console.error("Error deleting soil humidity:", error);
    res.status(500).send("Error deleting soil humidity");
  }
});

// Endpoints para CO2
router.get("/co2", async (req, res) => {
  try {
    const co2Levels = await prisma.co2.findMany();

    console.log("co2Levels", co2Levels);
    res.json(co2Levels);
  } catch (error) {
    console.error("Error fetching CO2 levels:", error);
    res.status(500).send("Error fetching CO2 levels");
  }
});

// Endpoint para obtener temperaturas por ID del invernadero
router.get("/co2/:greenhouseId", async (req, res) => {
  const { greenhouseId } = req.params;
  try {
    const co2Levels = await prisma.co2.findMany({
      where: {
        greenhouseId: parseInt(greenhouseId, 10),
      },
    });
    res.json(co2Levels);
  } catch (error) {
    console.error(
      `Error fetching luminosities for greenhouseId ${greenhouseId}:`,
      error
    );
    res.status(500).send("Error fetching luminosities");
  }
});

router.post("/co2", async (req, res) => {
  try {
    const { value, greenhouseId } = req.body;
    const newCO2 = await prisma.conc.create({
      data: {
        value,
        greenhouseId,
      },
    });
    res.json(newCO2);
  } catch (error) {
    console.error("Error creating a new CO2 level:", error);
    res.status(500).send("Error creating a new CO2 level");
  }
});

router.put("/co2/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { value, greenhouseId } = req.body;
    const updatedCO2 = await prisma.conc.update({
      where: { id: parseInt(id) },
      data: {
        value,
        greenhouseId,
      },
    });
    res.json(updatedCO2);
  } catch (error) {
    console.error("Error updating CO2 level:", error);
    res.status(500).send("Error updating CO2 level");
  }
});

router.delete("/co2/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.conc.delete({
      where: { id: parseInt(id) },
    });
    res.sendStatus(204);
  } catch (error) {
    console.error("Error deleting CO2 level:", error);
    res.status(500).send("Error deleting CO2 level");
  }
});

// Endpoints para Fan1
router.get("/fan1", async (req, res) => {
  try {
    const fan1Levels = await prisma.fan1.findMany();
    res.json(fan1Levels);
  } catch (error) {
    console.error("Error fetching Fan1 levels:", error);
    res.status(500).send("Error fetching Fan1 levels");
  }
});

router.get("/fan1/:greenhouseId", async (req, res) => {
  const { greenhouseId } = req.params;
  try {
    const fan1Levels = await prisma.fan1.findMany({
      where: {
        greenhouseId: parseInt(greenhouseId, 10),
      },
    });
    res.json(fan1Levels);
  } catch (error) {
    console.error(
      `Error fetching luminosities for greenhouseId ${greenhouseId}:`,
      error
    );
    res.status(500).send("Error fetching luminosities");
  }
});

router.post("/fan1", async (req, res) => {
  try {
    const { value, greenhouseId } = req.body;
    const newFan1 = await prisma.fan1.create({
      data: {
        value,
        greenhouseId,
      },
    });
    res.json(newFan1);
  } catch (error) {
    console.error("Error creating a new Fan1 level:", error);
    res.status(500).send("Error creating a new Fan1 level");
  }
});

router.put("/fan1/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { value, greenhouseId } = req.body;
    const updatedFan1 = await prisma.fan1.update({
      where: { id: parseInt(id) },
      data: {
        value,
        greenhouseId,
      },
    });
    res.json(updatedFan1);
  } catch (error) {
    console.error("Error updating Fan1 level:", error);
    res.status(500).send("Error updating Fan1 level");
  }
});

router.delete("/fan1/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.fan1.delete({
      where: { id: parseInt(id) },
    });
    res.sendStatus(204);
  } catch (error) {
    console.error("Error deleting Fan1 level:", error);
    res.status(500).send("Error deleting Fan1 level");
  }
});

// Endpoints para Lamp 1
router.get("/lamp1", async (req, res) => {
  try {
    const lamp1Levels = await prisma.lamp1.findMany();
    res.json(lamp1Levels);
  } catch (error) {
    console.error("Error fetching Lamp1 levels:", error);
    res.status(500).send("Error fetching Lamp1 levels");
  }
});

router.get("/lamp1/:greenhouseId", async (req, res) => {
  const { greenhouseId } = req.params;
  try {
    const lamp1Levels = await prisma.lamp1.findMany({
      where: {
        greenhouseId: parseInt(greenhouseId, 10),
      },
    });
    res.json(lamp1Levels);
  } catch (error) {
    console.error(
      `Error fetching luminosities for greenhouseId ${greenhouseId}:`,
      error
    );
    res.status(500).send("Error fetching luminosities");
  }
});

router.post("/lamp1", async (req, res) => {
  try {
    const { value, greenhouseId } = req.body;
    const newLamp1 = await prisma.lamp1.create({
      data: {
        value,
        greenhouseId,
      },
    });
    res.json(newLamp1);
  } catch (error) {
    console.error("Error creating a new Lamp1 level:", error);
    res.status(500).send("Error creating a new Lamp1 level");
  }
});

router.put("/lamp1/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { value, greenhouseId } = req.body;
    const updatedLamp1 = await prisma.lamp1.update({
      where: { id: parseInt(id) },
      data: {
        value,
        greenhouseId,
      },
    });
    res.json(updatedLamp1);
  } catch (error) {
    console.error("Error updating Lamp1 level:", error);
    res.status(500).send("Error updating Lamp1 level");
  }
});

router.delete("/lamp1/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.lamp1.delete({
      where: { id: parseInt(id) },
    });
    res.sendStatus(204);
  } catch (error) {
    console.error("Error deleting Lamp1 level:", error);
    res.status(500).send("Error deleting Lamp1 level");
  }
});

// Endpoints para Pump 1
router.get("/pump1", async (req, res) => {
  try {
    const pump1Levels = await prisma.pump1.findMany();
    res.json(pump1Levels);
  } catch (error) {
    console.error("Error fetching Pump1 levels:", error);
    res.status(500).send("Error fetching Pump1 levels");
  }
});

router.get("/pump1/:greenhouseId", async (req, res) => {
  const { greenhouseId } = req.params;
  try {
    const pump1Levels = await prisma.pump1.findMany({
      where: {
        greenhouseId: parseInt(greenhouseId, 10),
      },
    });
    res.json(pump1Levels);
  } catch (error) {
    console.error(
      `Error fetching luminosities for greenhouseId ${greenhouseId}:`,
      error
    );
    res.status(500).send("Error fetching luminosities");
  }
});

router.post("/pump1", async (req, res) => {
  try {
    const { value, greenhouseId } = req.body;
    const newPump1 = await prisma.pump1.create({
      data: {
        value,
        greenhouseId,
      },
    });
    res.json(newPump1);
  } catch (error) {
    console.error("Error creating a new Pump1 level:", error);
    res.status(500).send("Error creating a new Pump1 level");
  }
});

router.put("/pump1/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { value, greenhouseId } = req.body;
    const updatedPump1 = await prisma.pump1.update({
      where: { id: parseInt(id) },
      data: {
        value,
        greenhouseId,
      },
    });
    res.json(updatedPump1);
  } catch (error) {
    console.error("Error updating Pump1 level:", error);
    res.status(500).send("Error updating Pump1 level");
  }
});

router.delete("/pump1/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.pump1.delete({
      where: { id: parseInt(id) },
    });
    res.sendStatus(204);
  } catch (error) {
    console.error("Error deleting Pump1 level:", error);
    res.status(500).send("Error deleting Pump1 level");
  }
});

// Endpoints para Heater 1
router.get("/heater1", async (req, res) => {
  try {
    const heater1Levels = await prisma.heater1.findMany();
    res.json(heater1Levels);
  } catch (error) {
    console.error("Error fetching Heater1 levels:", error);
    res.status(500).send("Error fetching Heater1 levels");
  }
});

router.get("/heater1/:greenhouseId", async (req, res) => {
  const { greenhouseId } = req.params;
  try {
    const heater1Levels = await prisma.heater1.findMany({
      where: {
        greenhouseId: parseInt(greenhouseId, 10),
      },
    });
    res.json(heater1Levels);
  } catch (error) {
    console.error(
      `Error fetching luminosities for greenhouseId ${greenhouseId}:`,
      error
    );
    res.status(500).send("Error fetching luminosities");
  }
});

router.post("/heater1", async (req, res) => {
  try {
    const { value, greenhouseId } = req.body;
    const newHeater1 = await prisma.heater1.create({
      data: {
        value,
        greenhouseId,
      },
    });
    res.json(newHeater1);
  } catch (error) {
    console.error("Error creating a new Heater1 level:", error);
    res.status(500).send("Error creating a new Heater1 level");
  }
});

router.put("/heater1/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { value, greenhouseId } = req.body;
    const updatedHeater1 = await prisma.heater1.update({
      where: { id: parseInt(id) },
      data: {
        value,
        greenhouseId,
      },
    });
    res.json(updatedHeater1);
  } catch (error) {
    console.error("Error updating Heater1 level:", error);
    res.status(500).send("Error updating Heater1 level");
  }
});

router.delete("/heater1/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.heater1.delete({
      where: { id: parseInt(id) },
    });
    res.sendStatus(204);
  } catch (error) {
    console.error("Error deleting Heater1 level:", error);
    res.status(500).send("Error deleting Heater1 level");
  }
});

// Endpoints para ph
router.get("/ph", async (req, res) => {
  try {
    const phLevels = await prisma.ph.findMany();
    res.json(phLevels);
  } catch (error) {
    console.error("Error fetching ph levels:", error);
    res.status(500).send("Error fetching ph levels");
  }
});

router.post("/ph", async (req, res) => {
  try {
    const { value, greenhouseId } = req.body;
    const newPh = await prisma.ph.create({
      data: {
        value,
        greenhouseId,
      },
    });
    res.json(newPh);
  } catch (error) {
    console.error("Error creating a new ph level:", error);
    res.status(500).send("Error creating a new ph level");
  }
});

router.put("/ph/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { value, greenhouseId } = req.body;
    const updatedPh = await prisma.ph.update({
      where: { id: parseInt(id) },
      data: {
        value,
        greenhouseId,
      },
    });
    res.json(updatedPh);
  } catch (error) {
    console.error("Error updating ph level:", error);
    res.status(500).send("Error updating ph level");
  }
});

router.delete("/ph/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.ph.delete({
      where: { id: parseInt(id) },
    });
    res.sendStatus(204);
  } catch (error) {
    console.error("Error deleting ph level:", error);
    res.status(500).send("Error deleting ph level");
  }
});

//SENSORS
router.post("/sensors", async (req, res) => {
  const { temp, hum, lum, moi, conc, Ph } = req.body;
  const greenhouseId = 1; //default greenhouse
  console.log(req.body);
  console.log("PH", Ph);

  try {
    //temperature
    try {
      await prisma.temperature.create({
        data: {
          value: temp,
          greenhouseId,
        },
      });
    } catch (error) {
      console.error("Error creating temperature:", error);
    }

    //humidity
    try {
      await prisma.humidity.create({
        data: {
          value: hum,
          greenhouseId,
        },
      });
    } catch (error) {
      console.error("Error creating humidity:", error);
    }

    //luminosity
    try {
      await prisma.luminosity.create({
        data: {
          value: lum,
          greenhouseId,
        },
      });
    } catch (error) {
      console.error("Error creating luminosity:", error);
    }

    //moi
    try {
      await prisma.moi.create({
        data: {
          value: moi,
          greenhouseId,
        },
      });
    } catch (error) {
      console.error("Error creating moi:", error);
    }

    //conc
    try {
      await prisma.conc.create({
        data: {
          value: conc,
          greenhouseId,
        },
      });
    } catch (error) {
      console.error("Error creating conc:", error);
    }

    //conc
    try {
      await prisma.ph.create({
        data: {
          value: Ph,
          greenhouseId,
        },
      });
    } catch (error) {
      console.error("Error creating Ph:", error);
    }

    res.json("Sensors created");
  } catch (error) {
    res.status(500).send("Error creating sensors");
  }
});

//ACTUATORS
router.post("/actuators", async (req, res) => {
  const { rs_med, volts } = req.body;
  const greenhouseId = 1; //default greenhouse

  try {
    //rs_med
    try {
      await prisma.rs_med.create({
        data: {
          value: rs_med,
          greenhouseId,
        },
      });
    } catch (error) {
      console.error("Error creating rs_med:", error);
    }

    //volts
    try {
      await prisma.volts.create({
        data: {
          value: volts,
          greenhouseId,
        },
      });
    } catch (error) {
      console.error("Error creating volts:", error);
    }

    res.json("Sensors created");
  } catch (error) {
    res.status(500).send("Error creating sensors");
  }
});

export default router;
