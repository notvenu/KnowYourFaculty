// eslint-disable tailwindcss/no-custom-classname
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGithub,
  faLinkedin,
  faInstagram,
} from "@fortawesome/free-brands-svg-icons";
import { faEnvelope } from "@fortawesome/free-solid-svg-icons";

function ContactPage() {
  const contactChannels = [
    {
      title: "Email",
      subtitle: "venu.kasibhatia@gmail.com",
      href: "mailto:venu.kasibhatia@gmail.com",
      icon: faEnvelope,
      bgColor: "bg-red-100",
      iconColor: "text-red-600",
    },
    {
      title: "GitHub",
      subtitle: "@notvenu",
      href: "https://github.com/notvenu",
      icon: faGithub,
      bgColor: "bg-gray-100",
      iconColor: "text-(--text)",
    },
    {
      title: "LinkedIn",
      subtitle: "Venu Bhargava Jishith Kasibhatia",
      href: "https://linkedin.com/in/venu-kasibhatla",
      icon: faLinkedin,
      bgColor: "bg-blue-100",
      iconColor: "text-blue-600",
    },
    {
      title: "Instagram",
      subtitle: "@veeennuuu",
      href: "https://instagram.com/veeennnuuu",
      icon: faInstagram,
      bgColor: "bg-pink-100",
      iconColor: "text-pink-600",
    },
  ];

  return (
    <div className="animate-fadeIn w-full max-w-4xl mx-auto px-4 py-8">
      {/* Contact Us Section */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-(--text) mb-4">
          Contact Us
        </h1>
        <p className="text-lg text-(--muted) mb-8">
          Have questions or suggestions? Feel free to reach out through any of
          these channels:
        </p>

        {/* Contact Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contactChannels.map((channel) => (
            <a
              key={channel.title}
              href={channel.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 rounded-xl border border-(--line) bg-(--bg-elev) hover:border-(--primary) transition-all hover:shadow-md"
            >
              <FontAwesomeIcon
                icon={channel.icon}
                className={`text-2xl shrink-0 ${channel.iconColor}`}
              />
              <div className="flex-1">
                <p className="font-semibold text-(--text)">
                  {channel.title}
                </p>
                <p className="text-sm text-(--muted)">
                  {channel.subtitle}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-(--line) my-12"></div>

      {/* Contribute Section */}
      <div>
        <h2 className="text-3xl font-bold text-(--text) mb-4">
          Contribute on GitHub
        </h2>
        <p className="text-lg text-(--muted) mb-8">
          Found a bug or have a feature idea? Contribute to the project:
        </p>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="https://github.com/notvenu/KnowYourFaculty/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-4 p-6 rounded-xl border transition-all hover:shadow-lg"
            style={{
              borderColor: "#dc2626",
              backgroundColor:
                "color-mix(in srgb, #dc2626 15%, var(--bg-elev))",
            }}
          >
            <FontAwesomeIcon
              icon={faGithub}
              className="text-2xl text-red-600 mt-1 shrink-0"
            />
            <div className="flex-1">
              <p className="font-semibold text-(--text)">
                Report an Issue
              </p>
              <p className="text-sm text-(--muted)">
                Found a bug? Let us know
              </p>
            </div>
          </a>

          <a
            href="https://github.com/notvenu/KnowYourFaculty/pulls"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-4 p-6 rounded-xl border transition-all hover:shadow-lg"
            style={{
              borderColor: "#2563eb",
              backgroundColor:
                "color-mix(in srgb, #2563eb 15%, var(--bg-elev))",
            }}
          >
            <FontAwesomeIcon
              icon={faGithub}
              className="text-2xl text-blue-600 mt-1 shrink-0"
            />
            <div className="flex-1">
              <p className="font-semibold text-(--text)">
                Submit a Pull Request
              </p>
              <p className="text-sm text-(--muted)">
                Got improvements? Submit a PR
              </p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}

export default ContactPage;

