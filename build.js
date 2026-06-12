const fs = require('fs').promises;
const path = require('path');
const ejs = require('ejs');
const matter = require('gray-matter');
const { marked } = require('marked');

const DIST_DIR = path.join(__dirname, 'dist');
const VIEWS_DIR = path.join(__dirname, 'views');
const LOGS_DIR = path.join(__dirname, 'content', 'logs');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Scriptorium Subjects Data
const SUBJECTS_DATA = {
    'physics': {
        name: 'Physics',
        slug: 'physics',
        subtitle: 'VCE Physics Units 3 & 4',
        glyph: '⚛',
        description: 'An exploration of the fundamental laws governing the universe, from classical mechanics and electromagnetism to light, matter, and quantum physics.',
        resources: [
            {
                title: 'A3 EXAM CHEATSHEET',
                description: 'A comprehensive dual-page formula and annotation sheet formatted for A3 printing, compiled for units 3 & 4.',
                format: 'PDF',
                size: '3.4 MB',
                date: 'June 2026',
                downloadUrl: 'https://github.com/Apoo711/vce-resources/releases/download/v.0.0.3-physics/Physics.CheatSheet.EXAM.pdf'
            },
            {
                title: 'Hopkins Questions',
                description: 'An archive containing curated problems, challenge sheets, and detailed worked answers from the Hopkins physics repository.',
                format: 'ZIP',
                size: '18.5 MB',
                date: 'May 2026',
                downloadUrl: 'https://github.com/Apoo711/vce-resources/releases/download/v0.0.1-physics/questions-Hopkins.zip'
            },
            {
                title: 'Thermodynamics & Kinetic Theory',
                description: 'Detailed study notes covering thermal equilibrium, specific heat capacity, latent heat, the laws of thermodynamics, and kinetic gas behaviors.',
                format: 'PDF',
                size: '1.5 MB',
                date: 'April 2026',
                downloadUrl: 'https://github.com/Apoo711/vce-resources/releases/download/v0.0.1-physics/Physics_Thermodynamics_Kinetic_Theory.pdf'
            }
        ]
    },
    'sys-engineering': {
        name: 'Systems Engineering',
        slug: 'sys-engineering',
        subtitle: 'VCE Systems Engineering Units 3 & 4',
        glyph: '⚙',
        description: 'The science of mechanical, electro-technological, and digital control systems. Focuses on mechanical advantage, circuit logic, and control loops.',
        resources: [
            {
                title: 'Circuit Logic & Gate Diagrams',
                description: 'Complete blueprint detailing combinational logic, boolean expressions, truth tables, and implementation of logic gates in control setups.',
                format: 'PDF',
                size: '4.5 MB',
                date: 'May 2026',
                downloadUrl: 'https://github.com/Apoo711/vce-resources/releases/download/v0.0.1-syseng/SysEng_Circuit_Logic_Gate_Diagrams.pdf'
            },
            {
                title: 'Mechanical Advantage & Gears',
                description: 'Calculations and diagrams for mechanical advantage, velocity ratios, torque, and efficiency in complex gear trains, pulleys, and linkages.',
                format: 'PDF',
                size: '5.2 MB',
                date: 'March 2026',
                downloadUrl: 'https://github.com/Apoo711/vce-resources/releases/download/v0.0.1-syseng/SysEng_Mechanical_Advantage_Gears.pdf'
            },
            {
                title: 'Control Systems & Feedback Loops',
                description: 'Study of open and closed-loop control systems, sensor inputs, microcontroller scripting logic, and automated feedback execution.',
                format: 'PDF',
                size: '2.9 MB',
                date: 'June 2026',
                downloadUrl: 'https://github.com/Apoo711/vce-resources/releases/download/v0.0.1-syseng/SysEng_Control_Systems_Feedback_Loops.pdf'
            }
        ]
    },
    'specialist-maths': {
        name: 'Specialist Maths',
        slug: 'specialist-maths',
        subtitle: 'VCE Specialist Mathematics Units 3 & 4',
        glyph: '∫',
        description: 'Advanced mathematical structures and methods, covering complex number theory, vector calculus, differential equations, and mechanics.',
        resources: [
            {
                title: 'Bound Reference Unit 1&2',
                description: 'A complete, indexed study reference booklet covering the Units 1 & 2 Specialist Mathematics curriculum.',
                format: 'PDF',
                size: '12.1 MB',
                date: 'May 2026',
                downloadUrl: 'https://github.com/Apoo711/vce-resources/releases/download/0.0.2-smaths/Bound-Reference.U12.pdf'
            },
            {
                title: 'Complex Numbers & Polar Forms',
                description: 'In-depth derivation of Euler\'s formula, De Moivre\'s theorem, roots of unity, and region plotting in the Argand plane.',
                format: 'PDF',
                size: '2.4 MB',
                date: 'March 2026',
                downloadUrl: 'https://github.com/Apoo711/vce-resources/releases/download/0.0.2-smaths/SpecMaths_Complex_Numbers_Polar_Forms.pdf'
            },
            {
                title: 'Vector Calculus & Geometry',
                description: 'Vector proofs, vector functions, parameterization of curves, velocity and acceleration vectors, and intersections of planes and lines.',
                format: 'PDF',
                size: '3.1 MB',
                date: 'April 2026',
                downloadUrl: 'https://github.com/Apoo711/vce-resources/releases/download/0.0.2-smaths/SpecMaths_Vector_Calculus_Geometry.pdf'
            }
        ]
    },
    'methods': {
        name: 'Methods',
        slug: 'methods',
        subtitle: 'VCE Mathematical Methods Units 3 & 4',
        glyph: 'ƒ',
        description: 'Core algebraic, calculus, and statistical methods, focusing on functions, graphs, derivatives, integrals, and probability distributions.',
        resources: [
            {
                title: 'Calculus Foundations & Integration',
                description: 'A study of differentiation rules, chain/product/quotient rules, integration techniques, area under a curve, and kinematics applications.',
                format: 'PDF',
                size: '2.0 MB',
                date: 'April 2026',
                downloadUrl: 'https://github.com/Apoo711/vce-resources/releases/download/v0.0.1-methods/Methods_Calculus_Foundations_Integration.pdf'
            },
            {
                title: 'Probability & Random Variables',
                description: 'Comprehensive breakdown of discrete and continuous probability distributions, expected values, variance, and normal distribution models.',
                format: 'PDF',
                size: '1.7 MB',
                date: 'May 2026',
                downloadUrl: 'https://github.com/Apoo711/vce-resources/releases/download/v0.0.1-methods/Methods_Probability_Random_Variables.pdf'
            },
            {
                title: 'Functions, Relations & Transformations',
                description: 'Analysis of polynomial, exponential, logarithmic, and trigonometric functions alongside their translations, dilations, and reflections.',
                format: 'PDF',
                size: '1.4 MB',
                date: 'March 2026',
                downloadUrl: 'https://github.com/Apoo711/vce-resources/releases/download/v0.0.1-methods/Methods_Functions_Relations_Transformations.pdf'
            }
        ]
    },
    'chemistry': {
        name: 'Chemistry',
        slug: 'chemistry',
        subtitle: 'VCE Chemistry Units 3 & 4',
        glyph: '⌬',
        description: 'An analysis of chemical pathways, energy outputs, organic synthesis, instrumentation analyses, and chemical equilibrium principles.',
        resources: [
            {
                title: 'Organic Chemistry Pathways',
                description: 'Mapping of functional groups, reaction mechanisms (addition, substitution, condensation), esterification, and polymerizations.',
                format: 'PDF',
                size: '4.1 MB',
                date: 'May 2026',
                downloadUrl: 'https://github.com/Apoo711/vce-resources/releases/download/v0.0.1-chemistry/Chemistry_Organic_Chemistry_Pathways.pdf'
            },
            {
                title: 'Spectroscopic Interpretation Guide',
                description: 'Detailed methods for reading and interpreting Infrared (IR), Proton/Carbon NMR, and Mass Spectrometry plots to identify unknown molecules.',
                format: 'PDF',
                size: '2.2 MB',
                date: 'April 2026',
                downloadUrl: 'https://github.com/Apoo711/vce-resources/releases/download/v0.0.1-chemistry/Chemistry_Spectroscopic_Interpretation_Guide.pdf'
            },
            {
                title: 'Equilibrium & Acid-Base Systems',
                description: 'Le Chatelier\'s principle, equilibrium constants (Kc), pH scale, self-ionization of water, buffer solutions, and volumetric analyses.',
                format: 'PDF',
                size: '1.9 MB',
                date: 'June 2026',
                downloadUrl: 'https://github.com/Apoo711/vce-resources/releases/download/v0.0.1-chemistry/Chemistry_Equilibrium_Acid_Base_Systems.pdf'
            }
        ]
    },
    'english': {
        name: 'English',
        slug: 'english',
        subtitle: 'VCE English Units 3 & 4',
        glyph: '✍',
        description: 'The study of literature, rhetoric, and argument analysis. Focuses on structured critical writing, textual analysis, and persuasive language.',
        resources: [
            {
                title: 'Literary Techniques',
                description: 'A glossary of rhetorical strategies, persuasive tools, and literary devices used to construct textual arguments.',
                format: 'PDF',
                size: '1.2 MB',
                date: 'June 2026',
                downloadUrl: 'https://github.com/Apoo711/vce-resources/releases/download/v.0.0.3-english/Literary-Techniques.pdf'
            },
            {
                title: 'Mood Words',
                description: 'A categorized vocabulary index designed to enhance analytical writing, highlighting tone, attitude, and emotional registers.',
                format: 'PDF',
                size: '850 KB',
                date: 'June 2026',
                downloadUrl: 'https://github.com/Apoo711/vce-resources/releases/download/v.0.0.3-english/Moods.pdf'
            },
            {
                title: 'Argument Analysis Scaffold',
                description: 'A master guide detailing how writers use persuasive devices, tone shifts, appeals, and structural layout to position audiences.',
                format: 'PDF',
                size: '1.1 MB',
                date: 'March 2026',
                downloadUrl: 'https://github.com/Apoo711/vce-resources/releases/download/v.0.0.3-english/English_Argument_Analysis_Scaffold.pdf'
            }
        ]
    }
};

// Helper to copy directory recursively
async function copyDir(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}

// Helper to render an EJS view with the default layout
async function renderView(viewName, data, outputPath) {
    const layoutPath = path.join(VIEWS_DIR, 'layout.ejs');
    const viewPath = path.join(VIEWS_DIR, `${viewName}.ejs`);
    
    // Pass standard title and description locals
    const locals = {
        title: data.title || 'Aryan Gupta | Sanctum',
        description: data.description || 'Personal portfolio, laboratory, and digital sanctum.',
        ...data
    };

    const bodyContent = await ejs.renderFile(viewPath, locals);
    const fullHtml = await ejs.renderFile(layoutPath, {
        ...locals,
        body: bodyContent
    });
    
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, fullHtml, 'utf8');
    console.log(`[BUILD] Compiled: ${path.relative(__dirname, outputPath)}`);
}

async function build() {
    try {
        console.log('[BUILD] Starting static compilation...');
        
        // 1. Clean and create dist dir
        await fs.rm(DIST_DIR, { recursive: true, force: true });
        await fs.mkdir(DIST_DIR, { recursive: true });

        // 2. Render Index
        await renderView('index', {
            title: 'Aryan Gupta | Sanctum',
            description: 'Personal portfolio, laboratory, and digital sanctum.'
        }, path.join(DIST_DIR, 'index.html'));

        // 3. Render Poems Page
        await renderView('poems', {
            title: 'The Codex | Sanctum',
            description: 'A locked volume containing compiled verses, personal poetry, and digital manuscripts.'
        }, path.join(DIST_DIR, 'poems', 'index.html'));

        // 4. Render Resources (The Scriptorium)
        await renderView('resources', {
            title: 'The Scriptorium',
            subjects: Object.values(SUBJECTS_DATA)
        }, path.join(DIST_DIR, 'resources', 'index.html'));

        // 5. Render individual Scriptorium subjects
        for (const key in SUBJECTS_DATA) {
            const subject = SUBJECTS_DATA[key];
            await renderView('subject', {
                title: `${subject.name} | The Scriptorium`,
                subject
            }, path.join(DIST_DIR, 'resources', subject.slug, 'index.html'));
        }

        // 6. Render Blog Chronicles & individual articles
        const files = await fs.readdir(LOGS_DIR);
        const mdFiles = files.filter(f => f.endsWith('.md'));

        const posts = await Promise.all(
            mdFiles.map(async (filename) => {
                const raw = await fs.readFile(path.join(LOGS_DIR, filename), 'utf8');
                const { data } = matter(raw);
                const slug = filename.replace(/\.md$/, '');
                return { slug, ...data };
            })
        );

        posts.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Render blog list
        await renderView('blog', {
            title: 'The Chronicles | Sanctum',
            description: 'Expedition logs, conceptual dispatches, and structural observations from the Sanctum.',
            posts
        }, path.join(DIST_DIR, 'blog', 'index.html'));

        // Render individual blog posts
        for (const post of posts) {
            const filePath = path.join(LOGS_DIR, `${post.slug}.md`);
            const raw = await fs.writeFile ? null : ''; // dummy check
            const fileContent = await fs.readFile(filePath, 'utf8');
            const { data: meta, content } = matter(fileContent);
            const html = marked.parse(content);

            await renderView('post', {
                title: `${meta.title} | The Chronicles`,
                description: meta.description || '',
                meta,
                content: html
            }, path.join(DIST_DIR, 'blog', post.slug, 'index.html'));
        }

        // 7. Copy static assets (css, js, images)
        await copyDir(PUBLIC_DIR, DIST_DIR);
        console.log('[BUILD] Static assets copied successfully.');

        console.log('[BUILD] Compilation finished successfully. Output in /dist folder.');
    } catch (e) {
        console.error('[BUILD] Build failed:', e);
        process.exit(1);
    }
}

build();
